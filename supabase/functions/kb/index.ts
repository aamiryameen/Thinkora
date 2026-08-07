// Thinkora — AI Knowledge Base Edge Function.
//
// Keeps the Gemini API key server-side and exposes three actions:
//
//   embed   — batch-embed text chunks (or a single query) via the Gemini
//             embedding model. Vectors are returned to the client, which
//             stores them in on-device SQLite and runs cosine similarity
//             locally, so semantic search works offline after ingestion.
//   ask     — RAG: given retrieved context chunks + recent chat turns,
//             produce a grounded answer with inline [n] citation markers.
//   enrich  — one-shot document enrichment: title, language, tags,
//             quick/standard summaries and key points as strict JSON.
//
// Rate limiting reuses the same `increment_ai_usage` RPC as the `gemini`
// function so a device's daily budget is shared across all AI features.
// `embed` is deliberately exempt: it is cheap, and charging for it would
// make a single large upload consume a user's whole daily allowance.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const DAILY_LIMIT = 20;

const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// `gemini-embedding-001` produces 3072-dim vectors by default. We request 768
// via outputDimensionality to keep on-device storage and JS cosine math cheap:
// 768 floats ≈ 6 KB of JSON per chunk, and the model is trained to remain
// accurate when truncated to this size (Matryoshka representation learning).
const EMBED_MODEL = 'gemini-embedding-001';
const EMBED_DIMENSIONS = 768;
const EMBED_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;

/** Hard caps to protect the function from oversized payloads. */
const MAX_EMBED_TEXTS = 64;
const MAX_EMBED_CHARS = 8000;
const MAX_CONTEXT_CHARS = 60000;
const MAX_QUESTION_CHARS = 2000;
const MAX_ENRICH_CHARS = 24000;

type Action = 'embed' | 'ask' | 'enrich';

/** Matches KbExplainMode on the client. */
type ExplainMode =
  | 'simple' | 'eli10' | 'step-by-step'
  | 'examples' | 'beginner' | 'technical' | 'analogy';

interface ContextChunk {
  /** 1-based index the model must cite as [n]. */
  ref: number;
  documentTitle: string;
  heading?: string | null;
  page?: number | null;
  text: string;
}

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  deviceId: string;
  action: Action;
  // embed
  texts?: string[];
  /** RETRIEVAL_QUERY for a search query, RETRIEVAL_DOCUMENT for chunks. */
  taskType?: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT';
  // ask
  question?: string;
  context?: ContextChunk[];
  history?: ChatTurn[];
  kbName?: string;
  kbDescription?: string;
  explainMode?: ExplainMode;
  // enrich
  text?: string;
  fileName?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

const EXPLAIN_INSTRUCTIONS: Record<ExplainMode, string> = {
  simple: 'Write the answer in plain, simple English. Avoid jargon; if a technical term is unavoidable, define it in one short clause.',
  eli10: 'Explain as you would to a bright 10-year-old. Use everyday comparisons and short sentences. Stay accurate — simplify, do not distort.',
  'step-by-step': 'Structure the answer as clear numbered steps in the order they should be understood or performed.',
  examples: 'Anchor the answer in concrete, practical examples. Prefer showing over telling.',
  beginner: 'Assume the reader is a complete beginner. Define terms before using them and build up gradually.',
  technical: 'Give a precise, technical answer. Use correct terminology and do not oversimplify.',
  analogy: 'Explain primarily through a single well-chosen analogy, then briefly connect each part of the analogy back to the real concept.',
};

function buildAskPrompt(body: RequestBody): string {
  const {
    question = '', context = [], history = [],
    kbName, kbDescription, explainMode,
  } = body;

  const sources = context
    .map((c) => {
      const loc = [
        c.heading ? `section: ${c.heading}` : null,
        typeof c.page === 'number' ? `page ${c.page}` : null,
      ].filter(Boolean).join(', ');
      const header = loc
        ? `[${c.ref}] ${c.documentTitle} (${loc})`
        : `[${c.ref}] ${c.documentTitle}`;
      return `${header}\n${c.text}`;
    })
    .join('\n\n---\n\n');

  const convo = history.length
    ? history
        .map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`)
        .join('\n')
    : '';

  const kbLine = kbName
    ? `You are answering questions about the user's "${kbName}" knowledge base.${
        kbDescription ? ` Its purpose: ${kbDescription}.` : ''
      }`
    : "You are answering questions about the user's personal document library.";

  const styleLine = explainMode ? `\n\nSTYLE: ${EXPLAIN_INSTRUCTIONS[explainMode]}` : '';

  // The no-context branch matters: without it the model invents answers from
  // its own knowledge, which is exactly what breaks trust in a RAG feature.
  if (!context.length) {
    return `${kbLine}

The user asked a question but NO relevant passages were found in their documents.

Reply in 1-2 short sentences: say you could not find anything about this in their documents, and suggest they rephrase or upload a document covering it. Do NOT answer from your own general knowledge. Do NOT apologise more than once.

Question: ${question}`;
  }

  return `${kbLine}

Answer the user's question using ONLY the numbered sources below.

RULES:
- Ground every factual claim in the sources. Never use outside knowledge.
- Cite sources inline with square-bracket markers like [1] or [2][3], placed immediately after the claim they support.
- If the sources only partially answer the question, answer what you can and state plainly what is missing.
- If the sources do not answer the question at all, say so instead of guessing.
- Be direct. No preamble like "Based on the sources". Start with the answer.
- Use short paragraphs or bullets. Markdown is allowed for structure.${styleLine}
${convo ? `\nRecent conversation (for pronoun/context resolution only — do not treat as source material):\n${convo}\n` : ''}
SOURCES:
${sources}

QUESTION: ${question}`;
}

function buildEnrichPrompt(text: string, fileName?: string): string {
  return `Analyse the document below and return ONLY a JSON object — no markdown fence, no commentary.

Schema:
{
  "title": string,           // concise human title, max 80 chars. Derive from content, not filename, unless the content has no clear title.
  "language": string,        // ISO 639-1 code of the document's main language, e.g. "en"
  "tags": string[],          // 3-8 topic tags, Title Case, each 1-3 words. Specific over generic.
  "quickSummary": string,    // 1-2 sentences. The single most useful takeaway.
  "standardSummary": string, // 3-5 sentences covering scope, key arguments and conclusion.
  "keyPoints": string[]      // 3-7 standalone bullets, each a complete thought under 140 chars.
}

Rules:
- Base everything strictly on the document. Never invent facts.
- If the document is too short or unreadable to summarise, still return valid JSON with your best effort and an empty keyPoints array.
${fileName ? `\nFilename (weak hint only): ${fileName}` : ''}

DOCUMENT:
${text}`;
}

// ─── Gemini callers ───────────────────────────────────────────────────────────

/**
 * Calls Gemini with bounded exponential backoff on transient failures.
 *
 * 429 is included deliberately: Gemini's free tier enforces a
 * requests-per-minute cap that a single document ingest can trip (each chunk
 * is its own embed call). Those clear within seconds, so retrying turns what
 * would surface as a hard failure into a slightly slower success. Without
 * this, one burst leaves documents stuck in 'partial'.
 */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  const RETRYABLE = [429, 500, 502, 503, 504];
  const DELAYS_MS = [600, 1800, 4000];

  let res = await fetch(url, init);
  for (let attempt = 0; attempt < DELAYS_MS.length; attempt++) {
    if (!RETRYABLE.includes(res.status)) break;
    const wait = DELAYS_MS[attempt];
    console.warn(`gemini returned ${res.status}, retry ${attempt + 1} after ${wait}ms`);
    await new Promise((r) => setTimeout(r, wait));
    res = await fetch(url, init);
  }
  return res;
}

/**
 * Embeds texts one request at a time. Gemini's embedContent endpoint takes a
 * single content per call, so we bound concurrency to avoid tripping upstream
 * rate limits on large uploads.
 */
async function embedTexts(
  texts: string[],
  apiKey: string,
  taskType: string,
): Promise<{ vectors: (number[] | null)[]; failed: number }> {
  // Kept low on purpose: Gemini's free tier caps requests-per-minute, and a
  // multi-chunk document fires one embed call per chunk. Higher concurrency
  // trips that cap and pushes documents into 'partial'.
  const CONCURRENCY = 2;
  const vectors: (number[] | null)[] = new Array(texts.length).fill(null);
  let failed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < texts.length) {
      const index = cursor++;
      const content = texts[index].slice(0, MAX_EMBED_CHARS);
      try {
        const res = await fetchWithRetry(
          `${EMBED_ENDPOINT}?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: `models/${EMBED_MODEL}`,
              content: { parts: [{ text: content }] },
              taskType,
              outputDimensionality: EMBED_DIMENSIONS,
            }),
          },
        );
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          console.error('embed error', index, res.status, detail.slice(0, 300));
          failed++;
          continue;
        }
        const json = await res.json().catch(() => null);
        const values: number[] | undefined = json?.embedding?.values;
        if (Array.isArray(values) && values.length) {
          // Normalise to unit length so the client's cosine similarity reduces
          // to a plain dot product. Gemini does not normalise when
          // outputDimensionality is set to a truncated size.
          let norm = 0;
          for (const v of values) norm += v * v;
          norm = Math.sqrt(norm);
          vectors[index] = norm > 0 ? values.map((v) => v / norm) : values;
        } else {
          failed++;
        }
      } catch (err) {
        console.error('embed fetch error', index, err);
        failed++;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, texts.length) }, worker),
  );
  return { vectors, failed };
}

async function generate(
  prompt: string,
  apiKey: string,
  temperature: number,
  maxOutputTokens: number,
): Promise<{ ok: true; text: string } | { ok: false; status: number; error: string }> {
  let res: Response;
  try {
    res = await fetchWithRetry(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens },
      }),
    });
  } catch (err) {
    console.error('gemini fetch error', err);
    return { ok: false, status: 502, error: 'Upstream AI request failed' };
  }

  if (res.status === 429) {
    // Reached only after fetchWithRetry exhausted its backoff, so this is a
    // sustained limit (Gemini's daily free-tier generation quota) rather than
    // a momentary burst. Don't promise it clears "in a minute" — it may not
    // until the quota resets, and BYOK is the real escape hatch.
    return {
      ok: false,
      status: 429,
      error:
        "The shared AI service has reached its limit for now. Add your own free Gemini key in Settings for unlimited use, or try again later.",
    };
  }
  if (res.status === 503) {
    return { ok: false, status: 503, error: 'AI is temporarily overloaded. Please try again in a few seconds.' };
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('gemini error', res.status, detail.slice(0, 500));
    return { ok: false, status: 502, error: `Gemini error (${res.status})` };
  }

  const json = await res.json().catch(() => null);
  const candidate = json?.candidates?.[0];
  const finish = candidate?.finishReason;
  if (finish === 'SAFETY' || finish === 'RECITATION') {
    return { ok: false, status: 422, error: 'Request declined for safety reasons.' };
  }
  const text: string = (candidate?.content?.parts ?? [])
    .map((p: { text?: string }) => p?.text ?? '')
    .join('')
    .trim();

  if (!text) {
    return { ok: false, status: 502, error: 'Empty response from AI' };
  }
  return { ok: true, text };
}

/** Strips ```json fences the model sometimes emits despite instructions. */
function parseJsonLoose(raw: string): Record<string, unknown> | null {
  let s = raw.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    // Fall back to the outermost brace pair.
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      const parsed = JSON.parse(s.slice(start, end + 1));
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let payload: RequestBody;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { deviceId, action } = payload ?? {};
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length < 8 || deviceId.length > 128) {
    return jsonResponse({ error: 'Invalid deviceId' }, 400);
  }
  if (!action || !['embed', 'ask', 'enrich'].includes(action)) {
    return jsonResponse({ error: 'Invalid action' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');

  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Server not configured' }, 500);
  }
  if (!geminiKey) {
    return jsonResponse({ error: 'Gemini key not configured on server' }, 500);
  }

  // ── embed: not rate limited (see file header) ──────────────────────────────
  if (action === 'embed') {
    const texts = payload.texts;
    if (!Array.isArray(texts) || texts.length === 0) {
      return jsonResponse({ error: 'texts must be a non-empty array' }, 400);
    }
    if (texts.length > MAX_EMBED_TEXTS) {
      return jsonResponse({ error: `Too many texts (max ${MAX_EMBED_TEXTS})` }, 400);
    }
    if (texts.some((t) => typeof t !== 'string')) {
      return jsonResponse({ error: 'texts must all be strings' }, 400);
    }
    const taskType =
      payload.taskType === 'RETRIEVAL_QUERY' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT';

    const { vectors, failed } = await embedTexts(texts, geminiKey, taskType);
    if (failed === texts.length) {
      return jsonResponse({ error: 'Embedding failed for all texts' }, 502);
    }
    return jsonResponse({
      embeddings: vectors,
      dimensions: EMBED_DIMENSIONS,
      failed,
    });
  }

  // ── ask / enrich: rate limited per device ──────────────────────────────────
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: newCount, error: rpcError } = await supabase.rpc('increment_ai_usage', {
    p_device_id: deviceId,
    p_daily_limit: DAILY_LIMIT,
  });

  if (rpcError) {
    console.error('rate limit rpc error', rpcError);
    return jsonResponse({ error: 'Rate limit check failed' }, 500);
  }
  if (newCount === -1) {
    return jsonResponse(
      {
        error: 'Daily AI limit reached. Try again tomorrow or add your own Gemini key in Settings.',
        limit: DAILY_LIMIT,
      },
      429,
    );
  }

  const usage = { used: newCount, limit: DAILY_LIMIT, remaining: DAILY_LIMIT - newCount };

  if (action === 'ask') {
    const question = (payload.question ?? '').trim();
    if (question.length < 2) {
      return jsonResponse({ error: 'Question is too short' }, 400);
    }
    if (question.length > MAX_QUESTION_CHARS) {
      return jsonResponse({ error: 'Question is too long' }, 400);
    }

    // Trim context from the tail until it fits: retrieval already ordered
    // chunks by relevance, so the least relevant are dropped first.
    const context = Array.isArray(payload.context) ? [...payload.context] : [];
    let total = context.reduce((n, c) => n + (c?.text?.length ?? 0), 0);
    while (context.length > 1 && total > MAX_CONTEXT_CHARS) {
      const dropped = context.pop();
      total -= dropped?.text?.length ?? 0;
    }

    const history = (Array.isArray(payload.history) ? payload.history : [])
      .filter((t) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
      .slice(-6)
      .map((t) => ({ role: t.role, content: t.content.slice(0, 1500) }));

    const prompt = buildAskPrompt({ ...payload, question, context, history });
    const result = await generate(prompt, geminiKey, 0.3, 2048);
    if (!result.ok) {
      return jsonResponse({ error: result.error }, result.status);
    }
    return jsonResponse({ result: result.text, usage });
  }

  // action === 'enrich'
  const text = (payload.text ?? '').trim();
  if (text.length < 20) {
    return jsonResponse({ error: 'Document text is too short to analyse' }, 400);
  }

  const prompt = buildEnrichPrompt(text.slice(0, MAX_ENRICH_CHARS), payload.fileName);
  const result = await generate(prompt, geminiKey, 0.2, 2048);
  if (!result.ok) {
    return jsonResponse({ error: result.error }, result.status);
  }

  const parsed = parseJsonLoose(result.text);
  if (!parsed) {
    console.error('enrich returned unparseable JSON', result.text.slice(0, 300));
    return jsonResponse({ error: 'AI returned an unreadable response' }, 502);
  }

  const asStringArray = (v: unknown, max: number): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
         .map((x) => x.trim())
         .slice(0, max)
      : [];
  const asString = (v: unknown, max: number): string | null =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

  return jsonResponse({
    result: {
      title: asString(parsed.title, 120),
      language: asString(parsed.language, 8),
      tags: asStringArray(parsed.tags, 8),
      quickSummary: asString(parsed.quickSummary, 600),
      standardSummary: asString(parsed.standardSummary, 2000),
      keyPoints: asStringArray(parsed.keyPoints, 7),
    },
    usage,
  });
});
