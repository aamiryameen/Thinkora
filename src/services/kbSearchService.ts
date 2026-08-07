/**
 * On-device semantic + keyword search over knowledge base chunks.
 *
 * Embedding vectors live in SQLite (kb_chunks.embedding as JSON). At query
 * time we embed the question once via the proxy, then rank every chunk in the
 * knowledge base by cosine similarity in JS. Because vectors are stored
 * pre-normalised to unit length, cosine similarity is just a dot product.
 *
 * Two search modes, and the distinction matters for offline behaviour:
 *   - semantic : needs one network call to embed the query. Understands meaning.
 *   - keyword  : pure local BM25-ish scoring over chunk text. Always available.
 *
 * searchKnowledgeBase() runs semantic first and silently falls back to keyword
 * when offline or over quota, so search never hard-fails.
 */

import { Q } from '@nozbe/watermelondb';
import { kbChunksCollection, kbDocumentsCollection } from '../db';
import type { KbChunkModel } from '../db/models/KbChunkModel';
import type { KbDocumentModel } from '../db/models/KbDocumentModel';
import type { KbDocument, KbSearchHit } from '../types/knowledge';
import { embedQuery } from './kbAiService';
import { GeminiError } from './geminiService';

/** How many chunks to feed the model as RAG context. */
export const DEFAULT_TOP_K = 8;

/**
 * Minimum cosine similarity for a chunk to count as relevant.
 *
 * Tuned against the live gemini-embedding-001 endpoint at 768 dimensions,
 * because this model has a high similarity floor — even completely unrelated
 * text pairs sit around 0.41-0.49, so a naive low cutoff filters nothing.
 *
 * Measured on a 4-document corpus with paraphrase queries (no keyword overlap):
 *   correct hits                      0.66 - 0.72
 *   same-domain but wrong document    0.44 - 0.60
 *   off-topic query ("capital of Peru")     0.485
 *
 * 0.55 sits in the gap: it keeps every correct hit with ~0.10 of headroom while
 * rejecting off-topic queries, which matters because anything surviving this
 * filter is fed to the model as authoritative context. Chunks below it are
 * still reachable through keyword search.
 */
export const MIN_SEMANTIC_SCORE = 0.55;

// ─── Vector math ──────────────────────────────────────────────────────────────

/**
 * Dot product of two unit vectors == cosine similarity.
 * Falls back to full cosine when lengths differ (defensive: a model or
 * dimension change would otherwise silently produce garbage scores).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  // Vectors are stored normalised, so both norms are ~1 and this is a no-op.
  // If they are not, this keeps the score in a sane [-1, 1] range.
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

// ─── Keyword scoring ──────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
  'to', 'of', 'in', 'on', 'at', 'for', 'with', 'by', 'from', 'as', 'that', 'this',
  'these', 'those', 'it', 'its', 'do', 'does', 'did', 'what', 'which', 'who',
  'whom', 'how', 'why', 'when', 'where', 'about', 'i', 'me', 'my', 'we', 'our',
  'you', 'your', 'can', 'could', 'should', 'would', 'will', 'shall', 'may',
  'show', 'tell', 'find', 'give', 'explain', 'all', 'any', 'some', 'there',
]);

/** Splits a query into meaningful lowercase terms. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Scores a chunk against query terms. Rewards matching distinct terms over
 * repeating one, and gives a bonus for the full phrase appearing verbatim.
 * Normalised to roughly 0–1 so scores are comparable with cosine similarity.
 */
function keywordScore(text: string, terms: string[], phrase: string): number {
  if (!terms.length) return 0;
  const haystack = text.toLowerCase();

  let matchedTerms = 0;
  let occurrences = 0;
  for (const term of terms) {
    let idx = haystack.indexOf(term);
    if (idx === -1) continue;
    matchedTerms++;
    while (idx !== -1) {
      occurrences++;
      idx = haystack.indexOf(term, idx + term.length);
    }
  }
  if (matchedTerms === 0) return 0;

  // Coverage dominates; frequency contributes with diminishing returns.
  const coverage = matchedTerms / terms.length;
  const density = Math.min(1, Math.log1p(occurrences) / Math.log1p(terms.length * 3));
  const phraseBonus = phrase.length > 4 && haystack.includes(phrase) ? 0.25 : 0;

  return Math.min(1, coverage * 0.7 + density * 0.3 + phraseBonus);
}

// ─── Loading helpers ──────────────────────────────────────────────────────────

async function loadDocumentMap(kbId: string): Promise<Map<string, KbDocument>> {
  const docs = (await kbDocumentsCollection
    .query(Q.where('kb_id', kbId))
    .fetch()) as KbDocumentModel[];
  return new Map(docs.map((d) => [d.id, d.toPlain()]));
}

interface FetchOptions {
  /** Restrict the search to specific documents. Empty/undefined = whole KB. */
  documentIds?: string[];
}

async function loadChunks(kbId: string, opts: FetchOptions = {}): Promise<KbChunkModel[]> {
  const conditions = [Q.where('kb_id', kbId)];
  if (opts.documentIds?.length) {
    conditions.push(Q.where('document_id', Q.oneOf(opts.documentIds)));
  }
  return (await kbChunksCollection.query(...conditions).fetch()) as KbChunkModel[];
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SearchOptions extends FetchOptions {
  topK?: number;
  /** User's personal Gemini key, when set. Passed through to embedQuery. */
  userApiKey?: string | null;
  signal?: AbortSignal;
  /** Skip the network entirely and search locally. */
  keywordOnly?: boolean;
  minScore?: number;
}

export interface SearchOutcome {
  hits: KbSearchHit[];
  /** How the results were produced — lets the UI explain degraded results. */
  mode: 'semantic' | 'keyword';
  /**
   * Set when semantic search was attempted but fell back to keyword,
   * e.g. offline or daily limit reached.
   */
  fallbackReason: string | null;
}

/** Local-only keyword search. Never touches the network. */
export async function keywordSearch(
  kbId: string,
  query: string,
  opts: SearchOptions = {},
): Promise<KbSearchHit[]> {
  const terms = tokenize(query);
  if (!terms.length) return [];

  const topK = opts.topK ?? DEFAULT_TOP_K;
  const phrase = query.toLowerCase().trim();
  const [chunks, docMap] = await Promise.all([
    loadChunks(kbId, opts),
    loadDocumentMap(kbId),
  ]);

  const hits: KbSearchHit[] = [];
  for (const chunk of chunks) {
    const score = keywordScore(chunk.text, terms, phrase);
    if (score <= 0) continue;
    const document = docMap.get(chunk.documentId);
    if (!document) continue;
    hits.push({ chunk: chunk.toPlain(), document, score, matchType: 'keyword' });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, topK);
}

/**
 * Semantic search. Embeds the query, then ranks locally stored vectors.
 * Throws GeminiError when the query cannot be embedded — callers that want
 * graceful degradation should use searchKnowledgeBase() instead.
 */
export async function semanticSearch(
  kbId: string,
  query: string,
  opts: SearchOptions = {},
): Promise<KbSearchHit[]> {
  const topK = opts.topK ?? DEFAULT_TOP_K;
  const minScore = opts.minScore ?? MIN_SEMANTIC_SCORE;

  const [queryVector, chunks, docMap] = await Promise.all([
    embedQuery(query, opts.userApiKey ?? null, opts.signal),
    loadChunks(kbId, opts),
    loadDocumentMap(kbId),
  ]);

  if (!queryVector) {
    throw new GeminiError('Could not process your question. Please try again.', 'unknown');
  }

  const scored: KbSearchHit[] = [];
  for (const chunk of chunks) {
    const embedding = chunk.embedding;
    if (!embedding) continue;  // not yet embedded — keyword search still finds it
    const score = cosineSimilarity(queryVector, embedding);
    if (score < minScore) continue;
    const document = docMap.get(chunk.documentId);
    if (!document) continue;
    scored.push({ chunk: chunk.toPlain(), document, score, matchType: 'semantic' });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/**
 * The search entry point used by the UI and by RAG chat.
 *
 * Tries semantic search, then degrades to keyword search rather than failing:
 * a user who is offline or out of quota can still find their documents.
 */
export async function searchKnowledgeBase(
  kbId: string,
  query: string,
  opts: SearchOptions = {},
): Promise<SearchOutcome> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { hits: [], mode: 'keyword', fallbackReason: null };
  }

  if (opts.keywordOnly) {
    return {
      hits: await keywordSearch(kbId, trimmed, opts),
      mode: 'keyword',
      fallbackReason: null,
    };
  }

  try {
    const hits = await semanticSearch(kbId, trimmed, opts);
    // A semantic miss can still be a keyword hit (exact names, IDs, code
    // identifiers embed poorly), so try keyword before reporting nothing.
    if (hits.length === 0) {
      const fallback = await keywordSearch(kbId, trimmed, opts);
      if (fallback.length > 0) {
        return { hits: fallback, mode: 'keyword', fallbackReason: null };
      }
    }
    return { hits, mode: 'semantic', fallbackReason: null };
  } catch (err) {
    if ((err as any)?.name === 'AbortError') throw err;

    const reason =
      err instanceof GeminiError
        ? err.kind === 'quota'
          ? 'Daily AI limit reached — showing keyword matches instead.'
          : err.kind === 'network'
            ? 'Offline — showing keyword matches instead.'
            : 'AI search unavailable — showing keyword matches instead.'
        : 'AI search unavailable — showing keyword matches instead.';

    return {
      hits: await keywordSearch(kbId, trimmed, opts),
      mode: 'keyword',
      fallbackReason: reason,
    };
  }
}

/**
 * Finds documents related to a given one by averaging its chunk vectors into a
 * document centroid and comparing against the centroids of every other
 * document in the knowledge base. Fully offline — no query embedding needed.
 */
export async function findRelatedDocuments(
  kbId: string,
  documentId: string,
  limit = 5,
): Promise<{ document: KbDocument; score: number }[]> {
  const [chunks, docMap] = await Promise.all([
    loadChunks(kbId),
    loadDocumentMap(kbId),
  ]);

  const centroids = new Map<string, { sum: number[]; count: number }>();
  for (const chunk of chunks) {
    const embedding = chunk.embedding;
    if (!embedding) continue;
    const entry = centroids.get(chunk.documentId);
    if (!entry) {
      centroids.set(chunk.documentId, { sum: [...embedding], count: 1 });
      continue;
    }
    const len = Math.min(entry.sum.length, embedding.length);
    for (let i = 0; i < len; i++) entry.sum[i] += embedding[i];
    entry.count++;
  }

  const target = centroids.get(documentId);
  if (!target) return [];
  const targetVector = target.sum.map((v) => v / target.count);

  const related: { document: KbDocument; score: number }[] = [];
  for (const [docId, entry] of centroids) {
    if (docId === documentId) continue;
    const document = docMap.get(docId);
    if (!document) continue;
    const vector = entry.sum.map((v) => v / entry.count);
    related.push({ document, score: cosineSimilarity(targetVector, vector) });
  }

  related.sort((a, b) => b.score - a.score);
  return related.slice(0, limit);
}

/**
 * Counts chunks still missing an embedding — drives the "N chunks need
 * indexing" prompt so users can backfill what failed while offline.
 */
export async function countUnembeddedChunks(kbId: string): Promise<number> {
  const chunks = await loadChunks(kbId);
  return chunks.reduce((n, c) => (c.embedding ? n : n + 1), 0);
}
