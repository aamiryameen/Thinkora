/**
 * RAG chat over a knowledge base.
 *
 * Flow for one question:
 *   1. Resolve follow-ups ("how is it different?") against recent turns, so
 *      retrieval sees a self-contained query.
 *   2. Retrieve top-K chunks (semantic, falling back to keyword when offline).
 *   3. Ask the model, passing the chunks as numbered sources.
 *   4. Parse the [n] markers it emitted back into real citations.
 *
 * Messages persist in kb_messages, which is what gives each knowledge base its
 * own conversation memory across app restarts.
 */

import { Q } from '@nozbe/watermelondb';
import { database, kbMessagesCollection, knowledgeBasesCollection } from '../db';
import type { KbMessageModel } from '../db/models/KbMessageModel';
import type { KnowledgeBaseModel } from '../db/models/KnowledgeBaseModel';
import type {
  KbCitation,
  KbExplainMode,
  KbMessage,
  KbSearchHit,
} from '../types/knowledge';
import { askKb, extractCitations, type KbContextChunk } from './kbAiService';
import { searchKnowledgeBase, DEFAULT_TOP_K } from './kbSearchService';
import { GeminiError } from './geminiService';

/** How many prior turns to send as conversation memory. */
const HISTORY_TURNS = 6;

/** Truncate a chunk before sending, so one long chunk can't crowd out others. */
const MAX_CHUNK_CHARS = 4000;

// ─── Message persistence ──────────────────────────────────────────────────────

export async function loadMessages(kbId: string): Promise<KbMessage[]> {
  const rows = (await kbMessagesCollection
    .query(Q.where('kb_id', kbId), Q.sortBy('created_at', Q.asc))
    .fetch()) as KbMessageModel[];
  return rows.map((r) => r.toPlain());
}

async function saveMessage(
  kbId: string,
  role: 'user' | 'assistant',
  content: string,
  citations: KbCitation[] = [],
  error: string | null = null,
): Promise<KbMessage> {
  let saved: KbMessage | null = null;
  await database.write(async () => {
    const created = await kbMessagesCollection.create((m: KbMessageModel) => {
      m.kbId = kbId;
      m.role = role;
      m.content = content;
      m.citationsRaw = JSON.stringify(citations);
      m.error = error;
      m.createdAt = Date.now();
    });
    saved = (created as KbMessageModel).toPlain();
  });
  if (!saved) throw new Error('Failed to save message');
  return saved;
}

export async function clearMessages(kbId: string): Promise<void> {
  const rows = (await kbMessagesCollection
    .query(Q.where('kb_id', kbId))
    .fetch()) as KbMessageModel[];
  if (rows.length === 0) return;
  await database.write(async () => {
    await Promise.all(rows.map((r) => r.destroyPermanently()));
  });
}

export async function deleteMessage(messageId: string): Promise<void> {
  try {
    const row = (await kbMessagesCollection.find(messageId)) as KbMessageModel;
    await database.write(async () => { await row.destroyPermanently(); });
  } catch {
    // Already gone.
  }
}

// ─── Follow-up resolution ─────────────────────────────────────────────────────

/**
 * Detects a question that can't stand alone — "how does it compare?",
 * "explain that", "why?". These retrieve badly on their own because the
 * subject lives in the previous turn.
 */
function isFollowUp(question: string): boolean {
  const q = question.trim().toLowerCase();
  if (q.length < 30) {
    // Short questions leaning on a pronoun or bare comparative.
    if (/\b(it|that|this|they|them|those|these|there)\b/.test(q)) return true;
    if (/^(why|how|when|where|who|what about|and|so|then|explain|elaborate|more|continue|go on)\b/.test(q)) return true;
    if (/^(summari[sz]e|simplify|shorter|expand)\b/.test(q)) return true;
  }
  // Comparatives with no explicit second subject.
  if (/\b(compare|difference|different|versus|vs\.?|better|instead)\b/.test(q) && q.length < 60) {
    return true;
  }
  return false;
}

/**
 * Builds the query used for retrieval. For follow-ups we prepend the last user
 * question so the embedding carries the real subject; the model still receives
 * the original wording plus history.
 */
function buildRetrievalQuery(question: string, history: KbMessage[]): string {
  if (!isFollowUp(question) || history.length === 0) return question;

  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  if (!lastUser) return question;

  return `${lastUser.content} ${question}`.slice(0, 500);
}

// ─── Context assembly ─────────────────────────────────────────────────────────

/** Converts search hits into numbered sources plus a ref → citation map. */
function buildContext(hits: KbSearchHit[]): {
  context: KbContextChunk[];
  citationByRef: Map<number, KbCitation>;
} {
  const context: KbContextChunk[] = [];
  const citationByRef = new Map<number, KbCitation>();

  hits.forEach((hit, index) => {
    const ref = index + 1;
    const text = hit.chunk.text.slice(0, MAX_CHUNK_CHARS);

    context.push({
      ref,
      documentTitle: hit.document.title,
      heading: hit.chunk.heading,
      page: hit.chunk.page,
      text,
    });

    citationByRef.set(ref, {
      documentId: hit.document.id,
      documentTitle: hit.document.title,
      chunkId: hit.chunk.id,
      heading: hit.chunk.heading,
      page: hit.chunk.page,
      excerpt: text.slice(0, 400),
      sourceRef: ref,
    });
  });

  return { context, citationByRef };
}

// ─── Ask ──────────────────────────────────────────────────────────────────────

export interface AskOptions {
  userApiKey: string | null;
  explainMode?: KbExplainMode;
  /** Restrict retrieval to specific documents (e.g. "chat with this doc"). */
  documentIds?: string[];
  topK?: number;
  signal?: AbortSignal;
  /** Skip persisting the turn — used by one-off tools like flashcards. */
  ephemeral?: boolean;
}

export interface AskOutcome {
  userMessage: KbMessage | null;
  assistantMessage: KbMessage;
  /** Present when retrieval degraded, e.g. offline keyword fallback. */
  notice: string | null;
  retrievedCount: number;
}

/**
 * Asks a question against a knowledge base and persists both turns.
 *
 * Errors are captured onto the assistant message rather than thrown, so the
 * conversation always shows what happened and offers a retry.
 */
export async function askKnowledgeBase(
  kbId: string,
  question: string,
  opts: AskOptions,
): Promise<AskOutcome> {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error('Question is empty');
  }

  // Load KB metadata and prior turns for memory.
  let kbName: string | undefined;
  let kbDescription: string | undefined;
  try {
    const kb = (await knowledgeBasesCollection.find(kbId)) as KnowledgeBaseModel;
    kbName = kb.name;
    kbDescription = kb.description || undefined;
  } catch {
    // KB row missing; proceed without naming it.
  }

  const history = await loadMessages(kbId);
  const recentHistory = history
    .filter((m) => !m.error)
    .slice(-HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: m.content }));

  const userMessage = opts.ephemeral
    ? null
    : await saveMessage(kbId, 'user', trimmed);

  // ── Retrieve ──────────────────────────────────────────────────────────────
  const retrievalQuery = buildRetrievalQuery(trimmed, history);

  let hits: KbSearchHit[] = [];
  let notice: string | null = null;
  try {
    const outcome = await searchKnowledgeBase(kbId, retrievalQuery, {
      topK: opts.topK ?? DEFAULT_TOP_K,
      userApiKey: opts.userApiKey,
      documentIds: opts.documentIds,
      signal: opts.signal,
    });
    hits = outcome.hits;
    notice = outcome.fallbackReason;
  } catch (err) {
    if ((err as any)?.name === 'AbortError') throw err;
    const message =
      err instanceof GeminiError
        ? err.message
        : 'Search failed. Please try again.';
    const assistantMessage = opts.ephemeral
      ? { id: '', kbId, role: 'assistant' as const, content: '', citations: [], error: message, createdAt: Date.now() }
      : await saveMessage(kbId, 'assistant', '', [], message);
    return { userMessage, assistantMessage, notice: null, retrievedCount: 0 };
  }

  const { context, citationByRef } = buildContext(hits);

  // ── Generate ──────────────────────────────────────────────────────────────
  try {
    const { answer } = await askKb(
      {
        question: trimmed,
        context,
        history: recentHistory,
        kbName,
        kbDescription,
        explainMode: opts.explainMode,
      },
      opts.userApiKey,
      opts.signal,
    );

    const citations = extractCitations(
      answer,
      context,
      (ref) => citationByRef.get(ref) ?? null,
    );

    const assistantMessage = opts.ephemeral
      ? {
          id: '',
          kbId,
          role: 'assistant' as const,
          content: answer,
          citations,
          error: null,
          createdAt: Date.now(),
        }
      : await saveMessage(kbId, 'assistant', answer, citations);

    return { userMessage, assistantMessage, notice, retrievedCount: hits.length };
  } catch (err) {
    if ((err as any)?.name === 'AbortError') throw err;
    const message =
      err instanceof GeminiError
        ? err.message
        : 'Something went wrong. Please try again.';
    const assistantMessage = opts.ephemeral
      ? { id: '', kbId, role: 'assistant' as const, content: '', citations: [], error: message, createdAt: Date.now() }
      : await saveMessage(kbId, 'assistant', '', [], message);
    return { userMessage, assistantMessage, notice, retrievedCount: hits.length };
  }
}

/**
 * Retries a failed assistant turn: drops the error message and re-asks the
 * preceding user question.
 */
export async function retryLastAnswer(
  kbId: string,
  opts: AskOptions,
): Promise<AskOutcome | null> {
  const history = await loadMessages(kbId);
  if (history.length === 0) return null;

  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  if (!lastUser) return null;

  const last = history[history.length - 1];
  // Remove the failed assistant turn so it isn't duplicated.
  if (last.role === 'assistant') {
    await deleteMessage(last.id);
  }

  // Delete the OLD user turn only once the retry has stored a fresh one.
  // Deleting up front would lose the user's question entirely if the retry is
  // cancelled or throws, since askKnowledgeBase re-saves it mid-flight. On
  // failure the original stays in history, so nothing is lost.
  const previousUserId = lastUser.id;
  const outcome = await askKnowledgeBase(kbId, lastUser.content, opts);
  await deleteMessage(previousUserId);
  return outcome;
}

// ─── Document-scoped helpers ──────────────────────────────────────────────────

/**
 * Runs a prompt against one document's content without touching chat history.
 * Backs the per-document tools (chapter summaries, study questions, explain).
 */
export async function askDocument(
  kbId: string,
  documentId: string,
  question: string,
  opts: AskOptions,
): Promise<{ answer: string; citations: KbCitation[]; error: string | null }> {
  const outcome = await askKnowledgeBase(kbId, question, {
    ...opts,
    documentIds: [documentId],
    ephemeral: true,
    topK: opts.topK ?? 12,
  });
  return {
    answer: outcome.assistantMessage.content,
    citations: outcome.assistantMessage.citations,
    error: outcome.assistantMessage.error,
  };
}

// ─── Suggested questions ──────────────────────────────────────────────────────

/**
 * Starter prompts for an empty conversation. Derived from real document titles
 * and tags so they are always answerable from the user's own content.
 */
export function suggestQuestions(
  documents: { title: string; tags: string[] }[],
): string[] {
  if (documents.length === 0) return [];

  const suggestions: string[] = [];
  const first = documents[0];

  suggestions.push(`Summarise ${truncateTitle(first.title)}`);

  const tags = Array.from(new Set(documents.flatMap((d) => d.tags))).slice(0, 3);
  for (const tag of tags) {
    suggestions.push(`What do my documents say about ${tag}?`);
  }

  if (documents.length > 1) {
    suggestions.push('What are the key takeaways across all my documents?');
  }
  if (documents.length > 2) {
    suggestions.push(
      `Compare ${truncateTitle(documents[0].title)} and ${truncateTitle(documents[1].title)}`,
    );
  }

  return suggestions.slice(0, 4);
}

function truncateTitle(title: string): string {
  const clean = title.trim();
  return clean.length > 40 ? `${clean.slice(0, 37)}...` : clean;
}

// ─── Study tools ──────────────────────────────────────────────────────────────

export type StudyToolKind =
  | 'flashcards'
  | 'mcq'
  | 'short-answer'
  | 'revision-notes'
  | 'cheat-sheet'
  | 'key-concepts';

export type StudyDifficulty = 'easy' | 'medium' | 'hard';

const STUDY_PROMPTS: Record<StudyToolKind, (difficulty: StudyDifficulty) => string> = {
  flashcards: (d) =>
    `Create 8 ${d}-difficulty flashcards from these documents. Format each as:\n\nQ: <question>\nA: <answer>\n\nKeep answers under 2 sentences. Cover the most important ideas, not trivia.`,
  mcq: (d) =>
    `Create 6 ${d}-difficulty multiple-choice questions from these documents. Format each as:\n\n<number>. <question>\nA) <option>\nB) <option>\nC) <option>\nD) <option>\nAnswer: <letter> — <one-line why>\n\nMake the distractors plausible.`,
  'short-answer': (d) =>
    `Create 6 ${d}-difficulty short-answer study questions from these documents, each with a model answer of 2-3 sentences. Number them.`,
  'revision-notes': () =>
    `Write concise revision notes for these documents. Use headings and bullets. Prioritise what is most likely to be tested or reused. Keep it under 400 words.`,
  'cheat-sheet': () =>
    `Create a one-page cheat sheet for these documents: the essential definitions, formulas, commands or rules, grouped under short headings. Be terse — no prose paragraphs.`,
  'key-concepts': () =>
    `List the key concepts in these documents. For each: the term, a one-sentence definition, and why it matters. Order by importance.`,
};

export const STUDY_TOOL_LABELS: Record<StudyToolKind, string> = {
  flashcards: 'Flashcards',
  mcq: 'Multiple choice',
  'short-answer': 'Short answer',
  'revision-notes': 'Revision notes',
  'cheat-sheet': 'Cheat sheet',
  'key-concepts': 'Key concepts',
};

/**
 * Generates study material from a knowledge base or a single document.
 * Retrieval uses a broad query so the sample spans the whole source.
 */
export async function generateStudyMaterial(
  kbId: string,
  kind: StudyToolKind,
  opts: AskOptions & { difficulty?: StudyDifficulty },
): Promise<{ content: string; error: string | null }> {
  const difficulty = opts.difficulty ?? 'medium';
  const prompt = STUDY_PROMPTS[kind](difficulty);

  const outcome = await askKnowledgeBase(kbId, prompt, {
    ...opts,
    ephemeral: true,
    // Study material should draw on more of the source than a normal answer.
    topK: opts.topK ?? 16,
  });

  return {
    content: outcome.assistantMessage.content,
    error: outcome.assistantMessage.error,
  };
}
