/**
 * Voice Capture That Auto-Files — turns a freeform spoken sentence into a
 * structured task or note + reminder.
 *
 * Strategy
 *  • If the user has set their own Gemini API key, route the transcript
 *    through Gemini with a strict JSON-only prompt. Gemini is dramatically
 *    better than regex at handling natural language ("call ali about the
 *    proposal next Tuesday at 4ish").
 *  • Otherwise fall back to the existing regex `parseVoiceCommand` so the
 *    feature still works without a key.
 *
 * Returned shape is intentionally a superset of the legacy `VoiceIntent`
 * so callers can reuse the same execution branches.
 */

import { parseVoiceCommand, type VoiceIntent } from './voiceCommandService';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

export interface CapturedItem {
  /** Action to take. */
  kind: 'task' | 'note';
  title: string;
  /** Free-form notes/body (Gemini will populate this with context). */
  body: string;
  /** Unix ms when the task is due. Null = no date. */
  dueDate: number | null;
  /** Unix ms reminder time. Null = no reminder. */
  reminderDate: number | null;
  /** Tags that look like keywords from the speech (e.g. "work", "proposal"). */
  tags: string[];
  priority: 'none' | 'low' | 'medium' | 'high';
  /** True when Gemini was used; false when we fell back to regex parsing. */
  parsedByAi: boolean;
}

/** Schema string injected into the Gemini prompt — keep keys/types stable. */
const SCHEMA = `{
  "kind": "task" | "note",
  "title": "string (≤60 chars, imperative form for tasks)",
  "body": "string (extra context from the speech, may be empty)",
  "dueDateIso": "ISO datetime in user's local time, or null",
  "reminderIso": "ISO datetime, or null. Default to dueDateIso when user said 'remind'",
  "tags": ["string", ...] (lowercase keywords, max 4),
  "priority": "none" | "low" | "medium" | "high"
}`;

function buildPrompt(transcript: string, nowIso: string): string {
  return `You parse a user's spoken sentence into a JSON object that creates a productivity item.

Rules:
- "now" is ${nowIso}. Use this to resolve relative dates ("tomorrow", "next Tuesday", "tonight").
- Output STRICT JSON matching this schema. No prose, no markdown fences.
- Default kind is "task" unless the user says "note" or it's clearly a thought to remember.
- Title is concise and starts with a verb for tasks.
- If the user mentions any time ("at 5pm", "tonight", "morning"), set both dueDateIso and reminderIso to that local time.
- Times without an explicit hour: morning→09:00, afternoon→14:00, evening→18:00, night→21:00, tonight→20:00.
- Tags: extract obvious topical keywords (people names, projects, categories) — lowercase, no #.
- priority: "high" if user says urgent/asap/important; "low" if "if I have time"/"someday"; otherwise "none".

Schema:
${SCHEMA}

User said: ${JSON.stringify(transcript)}

Return only the JSON.`;
}

function parseGeminiJson(raw: string): CapturedItem | null {
  // Strip code-fence wrappers if Gemini returns them despite our instructions.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  let obj: any;
  try {
    obj = JSON.parse(cleaned);
  } catch {
    // Try to find the first {...} substring
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { obj = JSON.parse(match[0]); } catch { return null; }
  }

  const kind: 'task' | 'note' = obj?.kind === 'note' ? 'note' : 'task';
  const title: string = typeof obj?.title === 'string' && obj.title.trim().length > 0
    ? obj.title.trim()
    : '';
  if (!title) return null;

  const body: string = typeof obj?.body === 'string' ? obj.body.trim() : '';
  const tags: string[] = Array.isArray(obj?.tags)
    ? obj.tags.filter((t: unknown) => typeof t === 'string').map((t: string) => t.toLowerCase().trim()).filter(Boolean).slice(0, 4)
    : [];
  const priority = (['none', 'low', 'medium', 'high'].includes(obj?.priority) ? obj.priority : 'none') as CapturedItem['priority'];

  const toMs = (v: unknown): number | null => {
    if (typeof v !== 'string' || !v) return null;
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
  };
  const dueDate = toMs(obj?.dueDateIso);
  const reminderDate = toMs(obj?.reminderIso) ?? dueDate;

  return { kind, title, body, dueDate, reminderDate, tags, priority, parsedByAi: true };
}

/** Convert the legacy regex `VoiceIntent` into the new `CapturedItem`
 *  shape so callers don't need to special-case the fallback path. */
function intentToCaptured(intent: VoiceIntent, transcript: string): CapturedItem {
  if (intent.type === 'add_task') {
    return {
      kind: 'task',
      title: intent.title,
      body: '',
      dueDate: intent.dueDate ?? null,
      reminderDate: intent.dueDate ?? null,
      tags: [],
      priority: intent.priority ?? 'none',
      parsedByAi: false,
    };
  }
  if (intent.type === 'add_note') {
    return {
      kind: 'note',
      title: intent.title,
      body: intent.body ?? '',
      dueDate: null,
      reminderDate: null,
      tags: [],
      priority: 'none',
      parsedByAi: false,
    };
  }
  // For pomodoro/navigate/unknown, treat as a generic task with the raw text.
  return {
    kind: 'task',
    title: transcript.slice(0, 60),
    body: transcript.length > 60 ? transcript : '',
    dueDate: null,
    reminderDate: null,
    tags: [],
    priority: 'none',
    parsedByAi: false,
  };
}

/**
 * Parse a freeform transcript into a CapturedItem. Uses Gemini if a user
 * key is provided; otherwise falls back to the regex parser. Always resolves
 * — never throws — so the UI stays simple.
 */
export async function captureFromVoice(
  transcript: string,
  userApiKey: string | null,
  signal?: AbortSignal,
): Promise<CapturedItem> {
  const trimmed = transcript.trim();
  if (!trimmed) {
    return {
      kind: 'task', title: '', body: '', dueDate: null, reminderDate: null,
      tags: [], priority: 'none', parsedByAi: false,
    };
  }

  if (!userApiKey || !userApiKey.trim()) {
    return intentToCaptured(parseVoiceCommand(trimmed), trimmed);
  }

  const prompt = buildPrompt(trimmed, new Date().toISOString());
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(userApiKey.trim())}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
      }),
      signal,
    });
    if (!res.ok) {
      // Soft-fall-through: regex still works.
      return intentToCaptured(parseVoiceCommand(trimmed), trimmed);
    }
    const json: any = await res.json();
    const text: string | undefined = json?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p?.text ?? '').join('').trim();
    if (!text) return intentToCaptured(parseVoiceCommand(trimmed), trimmed);
    const parsed = parseGeminiJson(text);
    if (!parsed) return intentToCaptured(parseVoiceCommand(trimmed), trimmed);
    return parsed;
  } catch {
    return intentToCaptured(parseVoiceCommand(trimmed), trimmed);
  }
}
