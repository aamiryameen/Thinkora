import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_GEMINI_FUNCTION,
  AI_PROXY_ENABLED,
} from '../core/env';
import { getDeviceId } from './deviceIdService';

const DIRECT_GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly kind:
      | 'no-key'
      | 'rate-limit'
      | 'invalid-key'
      | 'network'
      | 'blocked'
      | 'quota'
      | 'overloaded'
      | 'unknown',
  ) {
    super(message);
    this.name = 'GeminiError';
  }

  /** Whether retrying the same request is likely to succeed. */
  get isRetryable(): boolean {
    return this.kind === 'overloaded' || this.kind === 'network' || this.kind === 'rate-limit';
  }
}

export type AiAction = 'summarize' | 'rewrite' | 'grammar' | 'tone' | 'subtasks';
export type ToneStyle = 'formal' | 'casual' | 'friendly' | 'concise';

export interface AiUsage {
  used: number;
  limit: number;
  remaining: number;
}

export interface AiCallResult {
  text: string;
  /** Set when the call went through Thinkora's proxy. null when using user's own key. */
  usage: AiUsage | null;
  source: 'proxy' | 'user-key';
}

interface RunOptions {
  /** User-provided Gemini key. When set, bypasses the proxy and calls Google directly. */
  userApiKey: string | null;
  action: AiAction;
  text: string;
  tone?: ToneStyle;
  signal?: AbortSignal;
}

async function callProxy(opts: RunOptions): Promise<AiCallResult> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new GeminiError('Thinkora AI is not configured. Try adding your own Gemini key in Settings.', 'no-key');
  }
  const deviceId = await getDeviceId();
  const url = `${SUPABASE_URL}/functions/v1/${SUPABASE_GEMINI_FUNCTION}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        deviceId,
        action: opts.action,
        text: opts.text,
        tone: opts.tone,
      }),
      signal: opts.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new GeminiError('Network error. Check your connection and try again.', 'network');
  }

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // fall through; body stays null
  }

  if (res.status === 429) {
    throw new GeminiError(
      "You've reached today's free AI limit. Add your own Gemini key in Settings for unlimited use, or try again tomorrow.",
      'quota',
    );
  }
  if (res.status === 503) {
    throw new GeminiError(
      'AI is busy right now. Please try again in a few seconds.',
      'overloaded',
    );
  }
  if (res.status === 422) {
    throw new GeminiError(
      "This text couldn't be processed. Try rewording it and try again.",
      'blocked',
    );
  }
  if (!res.ok) {
    throw new GeminiError(
      "Something went wrong on our end. Please try again.",
      'unknown',
    );
  }

  const text: string | undefined = body?.result;
  if (!text) {
    throw new GeminiError("The AI didn't return a response. Please try again.", 'unknown');
  }

  const usage: AiUsage | null = body?.usage ?? null;
  return { text, usage, source: 'proxy' };
}

async function callDirect(opts: RunOptions): Promise<AiCallResult> {
  const key = opts.userApiKey?.trim();
  if (!key) {
    throw new GeminiError('Add your Gemini API key in Settings to use AI features.', 'no-key');
  }
  const prompt = buildPrompt(opts.action, opts.text, opts.tone);
  const temperature =
    opts.action === 'grammar' ? 0.2 :
    opts.action === 'subtasks' ? 0.3 :
    opts.action === 'rewrite' ? 0.6 : 0.4;

  let res: Response;
  try {
    res = await fetch(`${DIRECT_GEMINI_ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens: 1024 },
      }),
      signal: opts.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new GeminiError('Network error. Check your connection and try again.', 'network');
  }

  if (res.status === 400 || res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => '');
    const kind: GeminiError['kind'] = /API key|API_KEY|unauthorized|permission/i.test(body)
      ? 'invalid-key'
      : 'unknown';
    throw new GeminiError(
      kind === 'invalid-key'
        ? "Your Gemini API key isn't valid. Double-check it in Settings."
        : "This request couldn't be processed. Try rewording your note.",
      kind,
    );
  }
  if (res.status === 429) {
    throw new GeminiError(
      "You're sending requests too fast. Wait a moment and try again.",
      'rate-limit',
    );
  }
  if (res.status === 503 || res.status === 500) {
    throw new GeminiError(
      'AI is busy right now. Please try again in a few seconds.',
      'overloaded',
    );
  }
  if (!res.ok) {
    throw new GeminiError('Something went wrong. Please try again.', 'unknown');
  }

  const json = await res.json().catch(() => null);
  const candidate = json?.candidates?.[0];
  const finish = candidate?.finishReason;
  if (finish === 'SAFETY' || finish === 'RECITATION') {
    throw new GeminiError(
      "This text couldn't be processed. Try rewording it and try again.",
      'blocked',
    );
  }
  const text: string | undefined = candidate?.content?.parts
    ?.map((p: { text?: string }) => p?.text ?? '')
    .join('')
    .trim();
  if (!text) {
    throw new GeminiError("The AI didn't return a response. Please try again.", 'unknown');
  }
  return { text, usage: null, source: 'user-key' };
}

function buildPrompt(action: AiAction, text: string, tone?: ToneStyle): string {
  const body = text.trim();
  switch (action) {
    case 'summarize':
      return `Summarize the following note in 2-3 concise bullet points. Return only the bullets, no preamble.\n\n${body}`;
    case 'rewrite':
      return `Rewrite the following note to be clearer and better organized. Preserve all facts and meaning. Return only the rewritten text, no preamble.\n\n${body}`;
    case 'grammar':
      return `Fix grammar, spelling, and punctuation in the following text. Keep the original wording and tone as much as possible. Return only the corrected text, no preamble.\n\n${body}`;
    case 'tone': {
      const styles: Record<ToneStyle, string> = {
        formal: 'professional and formal',
        casual: 'casual and conversational',
        friendly: 'warm and friendly',
        concise: 'significantly shorter while keeping all key points',
      };
      const style = tone && styles[tone] ? styles[tone] : styles.friendly;
      return `Rewrite the following text in a ${style} tone. Preserve all facts. Return only the rewritten text, no preamble.\n\n${body}`;
    }
    case 'subtasks':
      return `Break the following task into 3 to 6 concrete, actionable subtasks.
Rules:
- Each subtask starts with an imperative verb (e.g. "Write", "Design", "Review", "Call").
- Each subtask is under 60 characters.
- Order them in the sequence they should be done.
- Return ONLY the subtasks, one per line, no numbering, no bullets, no preamble, no explanation.

Task:
${body}`;
  }
}

/**
 * Runs an AI action. If the user has set their own Gemini key, calls Google
 * directly with that key (no rate limit). Otherwise routes through Thinkora's
 * Supabase Edge Function (shared daily limit enforced server-side).
 */
async function runAi(opts: RunOptions): Promise<AiCallResult> {
  if (opts.userApiKey && opts.userApiKey.trim()) {
    return callDirect(opts);
  }
  if (AI_PROXY_ENABLED) {
    return callProxy(opts);
  }
  throw new GeminiError(
    'Add your Gemini API key in Settings to use AI features.',
    'no-key',
  );
}

/** Quick round-trip to verify a user-provided key works. */
export async function testGeminiKey(apiKey: string, signal?: AbortSignal): Promise<boolean> {
  await callDirect({
    userApiKey: apiKey,
    action: 'grammar',
    text: 'test',
    signal,
  });
  return true;
}

export async function summarizeNote(
  userApiKey: string | null,
  noteText: string,
  signal?: AbortSignal,
): Promise<AiCallResult> {
  return runAi({ userApiKey, action: 'summarize', text: noteText, signal });
}

export async function rewriteNote(
  userApiKey: string | null,
  noteText: string,
  signal?: AbortSignal,
): Promise<AiCallResult> {
  return runAi({ userApiKey, action: 'rewrite', text: noteText, signal });
}

export async function fixGrammar(
  userApiKey: string | null,
  noteText: string,
  signal?: AbortSignal,
): Promise<AiCallResult> {
  return runAi({ userApiKey, action: 'grammar', text: noteText, signal });
}

export async function shiftTone(
  userApiKey: string | null,
  noteText: string,
  tone: ToneStyle,
  signal?: AbortSignal,
): Promise<AiCallResult> {
  return runAi({ userApiKey, action: 'tone', text: noteText, tone, signal });
}

/**
 * Generate an array of short, actionable subtask titles from a task description.
 * Filters out common AI noise (empty lines, leading bullets/numbers, obvious preamble).
 */
export async function generateSubtasks(
  userApiKey: string | null,
  taskDescription: string,
  signal?: AbortSignal,
): Promise<{ subtasks: string[]; usage: AiUsage | null; source: 'proxy' | 'user-key' | 'heuristic' }> {
  // Try AI first. If anything fails (no key, proxy down, parse error, blocked
  // content), fall back to a heuristic split so the user is never blocked.
  try {
    const result = await runAi({
      userApiKey,
      action: 'subtasks',
      text: taskDescription,
      signal,
    });
    const subtasks = result.text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .map((l) => l.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '').trim())
      .filter((l) => l.length > 0 && l.length <= 120)
      .filter((l) => !/^(here (are|is)|sure,?|okay,?|these are)/i.test(l))
      .filter((l) => !l.endsWith(':'));

    if (subtasks.length > 0) {
      return { subtasks: subtasks.slice(0, 8), usage: result.usage, source: result.source };
    }
    // AI returned but parse produced nothing usable — fall through to heuristic.
  } catch (err: any) {
    // Abort: bubble up so the UI can react. Anything else: silent fallback.
    if (err?.name === 'AbortError') throw err;
    // Quota / rate-limit / no-key / overloaded / network → heuristic still works.
  }

  const heuristic = heuristicSubtasks(taskDescription);
  if (heuristic.length === 0) {
    throw new GeminiError("Add a more descriptive task title or notes so we can break it down.", 'unknown');
  }
  return { subtasks: heuristic, usage: null, source: 'heuristic' };
}

/**
 * Offline subtask generator. Splits a task description into 3–5 actionable
 * steps using punctuation, conjunctions, and a small library of templates
 * triggered by leading verbs ("write", "build", "plan", etc).
 *
 * Not as smart as the AI, but always works and never blocks the user.
 */
function heuristicSubtasks(input: string): string[] {
  const text = input.trim();
  if (text.length === 0) return [];

  // 1) Try splitting on explicit list separators first.
  const fragments = text
    .split(/(?:\s*(?:,|;|\bthen\b|\band\b|\bplus\b)\s*)|(?:\r?\n)/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3 && s.length <= 80);

  // Drop the original full string if it accidentally survived as a "fragment".
  const distinct = Array.from(new Set(
    fragments.map((s) => s.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '').trim()),
  )).filter((s) => s.toLowerCase() !== text.toLowerCase());

  if (distinct.length >= 2) {
    return distinct
      .slice(0, 6)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  }

  // 2) Otherwise, use templates keyed on the first verb.
  const lower = text.toLowerCase();
  const lead = lower.split(/\s+/)[0] ?? '';
  const subject = text.replace(/^[a-z]+\s+/i, '').trim() || 'this';

  const templates: { match: RegExp; steps: string[] }[] = [
    { match: /^(write|draft|compose|prepare)\b/i, steps: [
      `Outline ${subject}`,
      `Draft the first version`,
      `Review and revise`,
      `Finalize and share`,
    ]},
    { match: /^(build|create|make|develop|implement)\b/i, steps: [
      `Plan the approach for ${subject}`,
      `Set up what you need`,
      `Build the core part`,
      `Test and refine`,
    ]},
    { match: /^(plan|organize|arrange|schedule)\b/i, steps: [
      `Define the goal of ${subject}`,
      `List what's needed`,
      `Set the date and time`,
      `Confirm with everyone involved`,
    ]},
    { match: /^(research|study|learn|read)\b/i, steps: [
      `Find sources for ${subject}`,
      `Read and take notes`,
      `Summarize key takeaways`,
      `Apply what you learned`,
    ]},
    { match: /^(call|email|message|contact|reach)\b/i, steps: [
      `Decide what to say`,
      `Reach out`,
      `Confirm next steps`,
    ]},
    { match: /^(buy|order|purchase|shop)\b/i, steps: [
      `List what to buy`,
      `Compare options`,
      `Make the purchase`,
    ]},
    { match: /^(clean|tidy|organize|declutter)\b/i, steps: [
      `Clear the surface`,
      `Sort items into keep/toss`,
      `Wipe down and finish`,
    ]},
    { match: /^(fix|repair|debug|resolve)\b/i, steps: [
      `Reproduce the issue`,
      `Identify the cause`,
      `Apply the fix`,
      `Verify it's resolved`,
    ]},
  ];

  const tpl = templates.find((t) => t.match.test(text));
  if (tpl) return tpl.steps.slice(0, 5);

  // 3) Generic last-resort breakdown.
  return [
    `Plan ${text}`,
    `Start working on it`,
    `Review progress`,
    `Wrap it up`,
  ];
}
