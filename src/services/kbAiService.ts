/**
 * Knowledge Base AI client.
 *
 * Talks to the `kb` Supabase Edge Function for three things:
 *   - embed()   : turn text into vectors (stored on-device for local search)
 *   - askKb()   : RAG answer grounded in retrieved chunks, with citations
 *   - enrich()  : title / language / tags / summaries for a document
 *
 * Mirrors geminiService.ts: same GeminiError shape and the same
 * bring-your-own-key escape hatch. When the user has set a personal Gemini
 * key we call Google directly and skip the shared daily limit entirely.
 *
 * ─── Monetization chokepoint ───────────────────────────────────────────────
 * Every paid AI call in this feature funnels through `runKbAction()`. To gate
 * the Knowledge Base behind a subscription later, add the entitlement check
 * there (and mirror it server-side in supabase/functions/kb/index.ts, since a
 * client-side flag alone is trivially bypassed).
 */

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_KB_FUNCTION,
  AI_PROXY_ENABLED,
} from '../core/env';
import { getDeviceId } from './deviceIdService';
import { GeminiError } from './geminiService';
import type { AiUsage } from './geminiService';
import type { KbCitation, KbExplainMode } from '../types/knowledge';

// Must match EMBED_MODEL / EMBED_DIMENSIONS in the kb Edge Function so
// vectors created via the proxy and via a personal key stay comparable.
const EMBED_MODEL = 'gemini-embedding-001';
export const EMBED_DIMENSIONS = 768;
const DIRECT_EMBED_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;
const DIRECT_GENERATE_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

/** Keep in sync with MAX_EMBED_TEXTS in the Edge Function. */
export const EMBED_BATCH_SIZE = 32;

/**
 * Per-request ceiling. Generous because the Edge Function retries Gemini with
 * backoff on rate limits, but bounded so a stalled socket reports a timeout
 * rather than sitting silent and then blaming the user's connection.
 */
const REQUEST_TIMEOUT_MS = 90000;

export type EmbedTaskType = 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT';

export interface KbContextChunk {
  ref: number;
  documentTitle: string;
  heading?: string | null;
  page?: number | null;
  text: string;
}

export interface KbChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface KbAskParams {
  question: string;
  context: KbContextChunk[];
  history?: KbChatTurn[];
  kbName?: string;
  kbDescription?: string;
  explainMode?: KbExplainMode;
}

export interface KbAskResult {
  answer: string;
  usage: AiUsage | null;
}

export interface KbEnrichment {
  title: string | null;
  language: string | null;
  tags: string[];
  quickSummary: string | null;
  standardSummary: string | null;
  keyPoints: string[];
}

// ─── Shared transport ─────────────────────────────────────────────────────────

interface KbRequest {
  action: 'embed' | 'ask' | 'enrich';
  [key: string]: unknown;
}

/**
 * Single chokepoint for all Edge Function calls. Maps HTTP status codes onto
 * the same GeminiError kinds the rest of the app already handles.
 */
async function callKbFunction(body: KbRequest, signal?: AbortSignal): Promise<any> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !AI_PROXY_ENABLED) {
    throw new GeminiError(
      'Thinkora AI is not configured. Add your own Gemini key in Settings to use the Knowledge Base.',
      'no-key',
    );
  }

  const deviceId = await getDeviceId();
  const url = `${SUPABASE_URL}/functions/v1/${SUPABASE_KB_FUNCTION}`;

  // The server may retry Gemini with backoff, so allow generous headroom —
  // but never hang forever, which surfaces as a bogus "check your connection".
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);
  // Honour both the caller's signal (screen unmount) and our own timeout.
  const onCallerAbort = () => timeout.abort();
  signal?.addEventListener('abort', onCallerAbort);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ deviceId, ...body }),
      signal: timeout.signal,
    });
  } catch (e: any) {
    // A caller-initiated abort must propagate so the UI can stay silent.
    if (signal?.aborted) {
      const abortErr = new Error('Aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    if (e?.name === 'AbortError') {
      throw new GeminiError(
        'That took too long. Please try again in a moment.',
        'network',
      );
    }
    throw new GeminiError('Network error. Check your connection and try again.', 'network');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }

  let parsed: any = null;
  try {
    parsed = await res.json();
  } catch {
    // leave null; handled below
  }

  if (res.status === 429) {
    // 429 has two causes. The per-device daily cap includes a `limit` field.
    // Otherwise the shared Gemini quota is exhausted — the server only returns
    // that after exhausting its own backoff, so it is not a momentary blip.
    // Both point the user at BYOK, which genuinely bypasses the limit.
    const isDeviceCap = typeof parsed?.limit === 'number';
    throw new GeminiError(
      isDeviceCap
        ? "You've reached today's free AI limit. Add your own Gemini key in Settings for unlimited use, or try again tomorrow."
        : (parsed?.error ||
           'The shared AI service is at its limit. Add your own free Gemini key in Settings for unlimited use, or try again later.'),
      'quota',
    );
  }
  if (res.status === 503) {
    throw new GeminiError('AI is busy right now. Please try again in a few seconds.', 'overloaded');
  }
  if (res.status === 422) {
    throw new GeminiError(
      "This content couldn't be processed. Try rewording it and try again.",
      'blocked',
    );
  }
  if (res.status === 404) {
    // The Edge Function isn't deployed. Retrying can never help, so say so
    // rather than showing a generic "try again" that sends users in circles.
    throw new GeminiError(
      'AI features are not set up yet. Add your own Gemini key in Settings to use the Knowledge Base offline of our servers.',
      'no-key',
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new GeminiError(
      'AI features are unavailable right now. Add your own Gemini key in Settings to continue.',
      'no-key',
    );
  }
  if (!res.ok) {
    throw new GeminiError(
      parsed?.error || 'Something went wrong on our end. Please try again.',
      'unknown',
    );
  }
  return parsed;
}

/**
 * Calls Google directly, retrying transient failures with backoff.
 *
 * 400/403 are returned as-is so the caller can report a bad key: retrying an
 * invalid credential only wastes the user's time.
 */
async function fetchDirectWithRetry(
  url: string,
  init: RequestInit,
  delaysMs: number[],
): Promise<Response> {
  let res = await fetch(url, init);
  for (let attempt = 0; attempt < delaysMs.length; attempt++) {
    if (res.status === 400 || res.status === 403) break;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable) break;
    await new Promise<void>((resolve) => setTimeout(resolve, delaysMs[attempt]));
    res = await fetch(url, init);
  }
  return res;
}

/** Normalises a vector to unit length so cosine similarity is a dot product. */
function normalize(values: number[]): number[] {
  let norm = 0;
  for (const v of values) norm += v * v;
  norm = Math.sqrt(norm);
  return norm > 0 ? values.map((v) => v / norm) : values;
}

// ─── Embeddings ───────────────────────────────────────────────────────────────

/** Embeds via the user's own key, one text per request (Gemini API shape). */
async function embedDirect(
  texts: string[],
  apiKey: string,
  taskType: EmbedTaskType,
  signal?: AbortSignal,
): Promise<(number[] | null)[]> {
  // A personal key is still subject to Google's per-minute rate limit, and a
  // multi-chunk document fires one request per chunk. Without backoff those
  // 429s become silent nulls, leaving the document stuck at 'partial' with no
  // error surfaced. Mirrors fetchWithRetry in the kb Edge Function.
  const RETRY_DELAYS_MS = [600, 1800, 4000];

  const out: (number[] | null)[] = [];
  for (const text of texts) {
    try {
      const res = await fetchDirectWithRetry(
        `${DIRECT_EMBED_ENDPOINT}?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: `models/${EMBED_MODEL}`,
            content: { parts: [{ text: text.slice(0, 8000) }] },
            taskType,
            outputDimensionality: EMBED_DIMENSIONS,
          }),
          signal,
        },
        RETRY_DELAYS_MS,
      );

      // 400/403 mean the key itself is bad — retrying cannot help.
      if (res.status === 400 || res.status === 403) {
        throw new GeminiError(
          'Your Gemini API key was rejected. Check it in Settings.',
          'invalid-key',
        );
      }

      if (!res.ok) {
        // Surface a sustained rate limit instead of silently dropping the
        // chunk, so the UI can tell the user to retry rather than showing a
        // document that is quietly missing half its index.
        if (res.status === 429) {
          throw new GeminiError(
            'Your Gemini key hit its rate limit. Wait a moment and finish indexing.',
            'rate-limit',
          );
        }
        out.push(null);
        continue;
      }

      const json = await res.json().catch(() => null);
      const values: number[] | undefined = json?.embedding?.values;
      out.push(Array.isArray(values) && values.length ? normalize(values) : null);
    } catch (e: any) {
      if (e?.name === 'AbortError' || e instanceof GeminiError) throw e;
      out.push(null);
    }
  }
  return out;
}

/**
 * Embeds a batch of texts. Returns one vector per input, with `null` for any
 * text that failed — callers persist the chunk anyway so keyword search still
 * works, and backfill the vector later.
 */
export async function embedTexts(
  texts: string[],
  opts: { userApiKey: string | null; taskType: EmbedTaskType; signal?: AbortSignal },
): Promise<(number[] | null)[]> {
  if (!texts.length) return [];

  const key = opts.userApiKey?.trim();
  if (key) {
    return embedDirect(texts, key, opts.taskType, opts.signal);
  }

  const results: (number[] | null)[] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const json = await callKbFunction(
      { action: 'embed', texts: batch, taskType: opts.taskType },
      opts.signal,
    );
    const vectors: unknown = json?.embeddings;
    if (!Array.isArray(vectors)) {
      throw new GeminiError('Embedding service returned an unexpected response.', 'unknown');
    }
    for (let j = 0; j < batch.length; j++) {
      const v = vectors[j];
      results.push(Array.isArray(v) && v.length ? (v as number[]) : null);
    }
  }
  return results;
}

/** Convenience wrapper for embedding a single search query. */
export async function embedQuery(
  query: string,
  userApiKey: string | null,
  signal?: AbortSignal,
): Promise<number[] | null> {
  const [vector] = await embedTexts([query], {
    userApiKey,
    taskType: 'RETRIEVAL_QUERY',
    signal,
  });
  return vector ?? null;
}

// ─── Generation helpers (BYOK direct path) ────────────────────────────────────

async function generateDirect(
  prompt: string,
  apiKey: string,
  temperature: number,
  signal?: AbortSignal,
): Promise<string> {
  // Retry transient failures with backoff, matching the Edge Function. A
  // personal key still has a per-minute cap, and asking two questions in quick
  // succession can trip it — that should self-heal, not surface as an error.
  const RETRY_DELAYS_MS = [600, 1800, 4000];

  let res: Response;
  try {
    res = await fetchDirectWithRetry(
      `${DIRECT_GENERATE_ENDPOINT}?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature, maxOutputTokens: 2048 },
        }),
        signal,
      },
      RETRY_DELAYS_MS,
    );
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new GeminiError('Network error. Check your connection and try again.', 'network');
  }

  if (res.status === 400 || res.status === 403) {
    throw new GeminiError('Your Gemini API key was rejected. Check it in Settings.', 'invalid-key');
  }
  if (res.status === 429) {
    throw new GeminiError('Your Gemini key hit its rate limit. Try again shortly.', 'rate-limit');
  }
  if (res.status === 503) {
    throw new GeminiError('AI is busy right now. Please try again in a few seconds.', 'overloaded');
  }
  if (!res.ok) {
    throw new GeminiError('Something went wrong calling Gemini. Please try again.', 'unknown');
  }

  const json = await res.json().catch(() => null);
  const candidate = json?.candidates?.[0];
  if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'RECITATION') {
    throw new GeminiError('Request declined for safety reasons.', 'blocked');
  }
  const text: string = (candidate?.content?.parts ?? [])
    .map((p: { text?: string }) => p?.text ?? '')
    .join('')
    .trim();
  if (!text) {
    throw new GeminiError("The AI didn't return a response. Please try again.", 'unknown');
  }
  return text;
}

// Prompt builders duplicated from the Edge Function so the BYOK path produces
// identical output. Keep the two in sync when editing either.

const EXPLAIN_INSTRUCTIONS: Record<KbExplainMode, string> = {
  simple: 'Write the answer in plain, simple English. Avoid jargon; if a technical term is unavoidable, define it in one short clause.',
  eli10: "Explain as you would to a bright 10-year-old. Use everyday comparisons and short sentences. Stay accurate — simplify, do not distort.",
  'step-by-step': 'Structure the answer as clear numbered steps in the order they should be understood or performed.',
  examples: 'Anchor the answer in concrete, practical examples. Prefer showing over telling.',
  beginner: 'Assume the reader is a complete beginner. Define terms before using them and build up gradually.',
  technical: 'Give a precise, technical answer. Use correct terminology and do not oversimplify.',
  analogy: 'Explain primarily through a single well-chosen analogy, then briefly connect each part of the analogy back to the real concept.',
};

function buildAskPrompt(params: KbAskParams): string {
  const { question, context, history = [], kbName, kbDescription, explainMode } = params;

  const kbLine = kbName
    ? `You are answering questions about the user's "${kbName}" knowledge base.${
        kbDescription ? ` Its purpose: ${kbDescription}.` : ''
      }`
    : "You are answering questions about the user's personal document library.";

  if (!context.length) {
    return `${kbLine}

The user asked a question but NO relevant passages were found in their documents.

Reply in 1-2 short sentences: say you could not find anything about this in their documents, and suggest they rephrase or upload a document covering it. Do NOT answer from your own general knowledge. Do NOT apologise more than once.

Question: ${question}`;
  }

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
    ? history.map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`).join('\n')
    : '';

  const styleLine = explainMode ? `\n\nSTYLE: ${EXPLAIN_INSTRUCTIONS[explainMode]}` : '';

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

// ─── Public AI actions ────────────────────────────────────────────────────────

/** Asks a grounded question over retrieved chunks. */
export async function askKb(
  params: KbAskParams,
  userApiKey: string | null,
  signal?: AbortSignal,
): Promise<KbAskResult> {
  const key = userApiKey?.trim();
  if (key) {
    const answer = await generateDirect(buildAskPrompt(params), key, 0.3, signal);
    return { answer, usage: null };
  }

  const json = await callKbFunction(
    {
      action: 'ask',
      question: params.question,
      context: params.context,
      history: params.history ?? [],
      kbName: params.kbName,
      kbDescription: params.kbDescription,
      explainMode: params.explainMode,
    },
    signal,
  );
  const answer: string | undefined = json?.result;
  if (!answer) {
    throw new GeminiError("The AI didn't return a response. Please try again.", 'unknown');
  }
  return { answer, usage: json?.usage ?? null };
}

function buildEnrichPrompt(text: string, fileName?: string): string {
  return `Analyse the document below and return ONLY a JSON object — no markdown fence, no commentary.

Schema:
{
  "title": string,
  "language": string,
  "tags": string[],
  "quickSummary": string,
  "standardSummary": string,
  "keyPoints": string[]
}

Rules:
- title: concise human title, max 80 chars, derived from content.
- language: ISO 639-1 code of the main language, e.g. "en".
- tags: 3-8 topic tags, Title Case, each 1-3 words, specific over generic.
- quickSummary: 1-2 sentences with the single most useful takeaway.
- standardSummary: 3-5 sentences covering scope, key arguments and conclusion.
- keyPoints: 3-7 standalone bullets, each a complete thought under 140 chars.
- Base everything strictly on the document. Never invent facts.
${fileName ? `\nFilename (weak hint only): ${fileName}` : ''}

DOCUMENT:
${text}`;
}

function parseJsonLoose(raw: string): Record<string, unknown> | null {
  let s = raw.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
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

function coerceEnrichment(parsed: Record<string, unknown>): KbEnrichment {
  const asStringArray = (v: unknown, max: number): string[] =>
    Array.isArray(v)
      ? v
          .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          .map((x) => x.trim())
          .slice(0, max)
      : [];
  const asString = (v: unknown, max: number): string | null =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

  return {
    title: asString(parsed.title, 120),
    language: asString(parsed.language, 8),
    tags: asStringArray(parsed.tags, 8),
    quickSummary: asString(parsed.quickSummary, 600),
    standardSummary: asString(parsed.standardSummary, 2000),
    keyPoints: asStringArray(parsed.keyPoints, 7),
  };
}

/** Generates title, language, tags, summaries and key points for a document. */
export async function enrichDocument(
  text: string,
  fileName: string,
  userApiKey: string | null,
  signal?: AbortSignal,
): Promise<KbEnrichment> {
  const trimmed = text.trim().slice(0, 24000);
  const key = userApiKey?.trim();

  if (key) {
    const raw = await generateDirect(buildEnrichPrompt(trimmed, fileName), key, 0.2, signal);
    const parsed = parseJsonLoose(raw);
    if (!parsed) {
      throw new GeminiError('AI returned an unreadable response.', 'unknown');
    }
    return coerceEnrichment(parsed);
  }

  const json = await callKbFunction(
    { action: 'enrich', text: trimmed, fileName },
    signal,
  );
  const result = json?.result;
  if (!result || typeof result !== 'object') {
    throw new GeminiError('AI returned an unreadable response.', 'unknown');
  }
  return coerceEnrichment(result as Record<string, unknown>);
}

/**
 * Freeform grounded generation used by study tools and explain-mode actions.
 * Routes through the same `ask` action so rate limiting stays consistent.
 */
export async function runKbPrompt(
  question: string,
  context: KbContextChunk[],
  userApiKey: string | null,
  opts: { kbName?: string; explainMode?: KbExplainMode; signal?: AbortSignal } = {},
): Promise<string> {
  const { answer } = await askKb(
    {
      question,
      context,
      kbName: opts.kbName,
      explainMode: opts.explainMode,
    },
    userApiKey,
    opts.signal,
  );
  return answer;
}

// ─── Citation parsing ─────────────────────────────────────────────────────────

/**
 * Extracts the [n] markers the model emitted and maps them back to the chunks
 * that were actually sent. Unreferenced context is dropped so the UI only
 * shows sources the answer really used.
 */
export function extractCitations(
  answer: string,
  context: KbContextChunk[],
  lookup: (ref: number) => KbCitation | null,
): KbCitation[] {
  const refs = new Set<number>();
  const pattern = /\[(\d{1,2})\]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(answer)) !== null) {
    const n = parseInt(match[1], 10);
    if (n >= 1 && n <= context.length) refs.add(n);
  }

  const citations: KbCitation[] = [];
  for (const ref of Array.from(refs).sort((a, b) => a - b)) {
    const citation = lookup(ref);
    // Stamp the marker the model emitted so the UI can match inline [n]
    // markers back to this citation without relying on array position.
    if (citation) citations.push({ ...citation, sourceRef: ref });
  }
  return citations;
}
