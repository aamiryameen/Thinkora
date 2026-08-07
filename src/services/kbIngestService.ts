/**
 * Knowledge Base ingestion pipeline.
 *
 * extract → chunk → embed → enrich → ready
 *
 * Each stage writes its progress back to the kb_documents row, so the UI can
 * render live status and a restarted app can tell what finished.
 *
 * Failure policy is deliberately graded, because the most common failure is a
 * flaky network rather than a bad document:
 *   - extraction fails  → status 'failed' (nothing usable)
 *   - embedding fails   → status 'partial' (keyword search still works,
 *                         vectors can be backfilled later)
 *   - enrichment fails  → status 'ready' (summaries are a bonus, not required)
 */

import { Q } from '@nozbe/watermelondb';
import {
  database,
  kbChunksCollection,
  kbDocumentsCollection,
  knowledgeBasesCollection,
} from '../db';
import type { KbDocumentModel } from '../db/models/KbDocumentModel';
import type { KbChunkModel } from '../db/models/KbChunkModel';
import type { KnowledgeBaseModel } from '../db/models/KnowledgeBaseModel';
import type {
  KbDocStatus,
  KbIngestProgress,
  KbSourceType,
} from '../types/knowledge';
import { embedTexts, EMBED_BATCH_SIZE } from './kbAiService';
import { enrichDocument } from './kbAiService';
import {
  extractFromFile,
  extractFromNote,
  ExtractionError,
  getFileSize,
} from './kbExtractionService';
import { GeminiError } from './geminiService';

// ─── Chunking ─────────────────────────────────────────────────────────────────

/**
 * Target chunk size in characters. ~1200 chars is roughly 300 tokens, which
 * keeps a chunk small enough to be a precise citation while large enough to
 * carry standalone meaning.
 */
const CHUNK_TARGET = 1200;
const CHUNK_MAX = 1800;
/**
 * Overlap between consecutive chunks so a sentence spanning a boundary is
 * still fully present in at least one chunk.
 */
const CHUNK_OVERLAP = 150;

export interface Chunk {
  text: string;
  heading: string | null;
  page: number | null;
  charStart: number;
  charEnd: number;
}

/** Detects markdown/plain headings so citations can name a section. */
function detectHeading(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120) return null;

  // Markdown ATX heading
  const md = /^(#{1,6})\s+(.+)$/.exec(trimmed);
  if (md) return md[2].trim();

  // "Chapter 4", "Section 2.1", "Part III", "Appendix B"
  if (/^(chapter|section|part|appendix|unit|lesson|module)\b[\s.:]*[\divxIVX]+/i.test(trimmed)) {
    return trimmed.replace(/[:.]$/, '');
  }

  // Numbered heading like "3.2 Retrieval"
  if (/^\d+(\.\d+)*\s+\p{Lu}/u.test(trimmed) && trimmed.length < 80) {
    return trimmed;
  }

  // ALL-CAPS line — a common heading style in plain text and PDFs.
  if (
    trimmed.length >= 4 &&
    trimmed.length <= 80 &&
    trimmed === trimmed.toUpperCase() &&
    /\p{Lu}/u.test(trimmed) &&
    !/[.!?]$/.test(trimmed)
  ) {
    return trimmed;
  }

  return null;
}

/**
 * Splits an oversized block into sentence-sized segments.
 *
 * Sentence punctuation is the preferred boundary, but text without any — OCR
 * output, minified data, CJK passages, transcripts — must still be bounded, so
 * any segment over CHUNK_MAX is hard-split on whitespace (and mid-word only as
 * a last resort). Without this a single run-on block becomes one giant chunk
 * that exceeds the embedding input limit and is useless as a citation.
 */
function splitIntoSegments(text: string): string[] {
  const sentences = text.match(/[^.!?\n]+[.!?]+[\s]*|[^.!?\n]+\n+|[^.!?\n]+$/g) ?? [text];

  const segments: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= CHUNK_MAX) {
      segments.push(sentence);
      continue;
    }
    let rest = sentence;
    while (rest.length > CHUNK_MAX) {
      // Prefer the last whitespace inside the window so words stay intact.
      const window = rest.slice(0, CHUNK_MAX);
      const breakAt = window.lastIndexOf(' ');
      const cut = breakAt > CHUNK_MAX * 0.5 ? breakAt + 1 : CHUNK_MAX;
      segments.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    if (rest) segments.push(rest);
  }
  return segments;
}

/**
 * Splits text into overlapping chunks on natural boundaries.
 *
 * Prefers paragraph breaks, then sentence ends, and only hard-splits when a
 * single sentence exceeds the max — so chunks stay semantically coherent,
 * which materially improves embedding quality.
 */
export function chunkText(
  text: string,
  opts: { pages?: string[] } = {},
): Chunk[] {
  const chunks: Chunk[] = [];
  const usePages = (opts.pages?.length ?? 0) > 0;

  // For paginated sources, chunk each page separately so page numbers stay
  // exact. Otherwise treat the whole document as one unit.
  const units: { text: string; page: number | null; offset: number }[] = [];
  if (usePages) {
    let offset = 0;
    opts.pages!.forEach((pageText, index) => {
      units.push({ text: pageText, page: index + 1, offset });
      offset += pageText.length + 3;   // account for the "\n\f\n" joiner
    });
  } else {
    units.push({ text, page: null, offset: 0 });
  }

  for (const unit of units) {
    if (!unit.text.trim()) continue;

    const lines = unit.text.split('\n');
    let currentHeading: string | null = null;

    // Build paragraph blocks, tracking the heading in force and the character
    // offset of each block within the unit.
    const blocks: { text: string; heading: string | null; start: number }[] = [];
    let buffer: string[] = [];
    let bufferStart = 0;
    let cursor = 0;

    const flush = () => {
      const joined = buffer.join('\n').trim();
      if (joined) blocks.push({ text: joined, heading: currentHeading, start: bufferStart });
      buffer = [];
    };

    for (const line of lines) {
      const heading = detectHeading(line);
      if (heading) {
        flush();
        currentHeading = heading;
        cursor += line.length + 1;
        bufferStart = cursor;
        continue;
      }
      if (!line.trim()) {
        flush();
        cursor += line.length + 1;
        bufferStart = cursor;
        continue;
      }
      if (buffer.length === 0) bufferStart = cursor;
      buffer.push(line);
      cursor += line.length + 1;
    }
    flush();

    // Pack blocks into chunks up to the target size.
    let currentText = '';
    let currentStart = 0;
    let currentHeadingForChunk: string | null = null;

    const pushChunk = () => {
      const body = currentText.trim();
      if (!body) return;
      chunks.push({
        text: body,
        heading: currentHeadingForChunk,
        page: unit.page,
        charStart: unit.offset + currentStart,
        charEnd: unit.offset + currentStart + body.length,
      });
    };

    for (const block of blocks) {
      // A single block larger than the max gets split on sentence boundaries.
      if (block.text.length > CHUNK_MAX) {
        if (currentText) { pushChunk(); currentText = ''; }

        const sentences = splitIntoSegments(block.text);
        let piece = '';
        let pieceStart = block.start;
        for (const sentence of sentences) {
          if (piece.length + sentence.length > CHUNK_TARGET && piece) {
            chunks.push({
              text: piece.trim(),
              heading: block.heading,
              page: unit.page,
              charStart: unit.offset + pieceStart,
              charEnd: unit.offset + pieceStart + piece.length,
            });
            // Carry an overlap tail into the next piece.
            const tail = piece.slice(-CHUNK_OVERLAP);
            pieceStart += piece.length - tail.length;
            piece = tail + sentence;
          } else {
            if (!piece) pieceStart = block.start;
            piece += sentence;
          }
        }
        if (piece.trim()) {
          chunks.push({
            text: piece.trim(),
            heading: block.heading,
            page: unit.page,
            charStart: unit.offset + pieceStart,
            charEnd: unit.offset + pieceStart + piece.length,
          });
        }
        continue;
      }

      if (currentText && currentText.length + block.text.length + 2 > CHUNK_TARGET) {
        pushChunk();
        // Overlap: keep the tail of the previous chunk for continuity.
        const tail = currentText.slice(-CHUNK_OVERLAP);
        currentStart = block.start - tail.length;
        currentText = tail ? `${tail}\n\n${block.text}` : block.text;
        currentHeadingForChunk = block.heading;
        continue;
      }

      if (!currentText) {
        currentStart = block.start;
        currentHeadingForChunk = block.heading;
      }
      currentText = currentText ? `${currentText}\n\n${block.text}` : block.text;
    }
    pushChunk();
  }

  // Guarantee at least one chunk for very short documents.
  if (chunks.length === 0 && text.trim()) {
    chunks.push({
      text: text.trim(),
      heading: null,
      page: usePages ? 1 : null,
      charStart: 0,
      charEnd: text.trim().length,
    });
  }

  return chunks;
}

// ─── Progress plumbing ────────────────────────────────────────────────────────

export type ProgressListener = (progress: KbIngestProgress) => void;

const listeners = new Set<ProgressListener>();

export function onIngestProgress(listener: ProgressListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(progress: KbIngestProgress) {
  listeners.forEach((l) => {
    try { l(progress); } catch { /* a bad listener must not break ingestion */ }
  });
}

const STATUS_LABELS: Record<KbDocStatus, string> = {
  queued: 'Queued',
  extracting: 'Reading document',
  chunking: 'Splitting into sections',
  embedding: 'Building search index',
  enriching: 'Summarising',
  ready: 'Ready',
  partial: 'Indexed for keyword search',
  failed: 'Failed',
};

async function updateDoc(
  documentId: string,
  changes: Partial<{
    status: KbDocStatus;
    progress: number;
    errorMessage: string | null;
    extractedText: string;
    pageCount: number;
    chunkCount: number;
    title: string;
    language: string | null;
    quickSummary: string | null;
    standardSummary: string | null;
    keyPoints: string[];
    tags: string[];
    fileSize: number;
  }>,
): Promise<void> {
  // Tracks the last known status per document so a progress-only update can
  // report the real stage. Emitting a default of 'queued' would make the UI
  // label flicker back to "Queued" mid-embedding.
  let effectiveStatus: KbDocStatus | undefined = changes.status;

  try {
    const doc = (await kbDocumentsCollection.find(documentId)) as KbDocumentModel;
    if (effectiveStatus === undefined) {
      effectiveStatus = doc.status as KbDocStatus;
    }
    await database.write(async () => {
      await doc.update((d) => {
        if (changes.status !== undefined) d.status = changes.status;
        if (changes.progress !== undefined) d.progress = changes.progress;
        if (changes.errorMessage !== undefined) d.errorMessage = changes.errorMessage;
        if (changes.extractedText !== undefined) d.extractedText = changes.extractedText;
        if (changes.pageCount !== undefined) d.pageCount = changes.pageCount;
        if (changes.chunkCount !== undefined) d.chunkCount = changes.chunkCount;
        if (changes.title !== undefined) d.title = changes.title;
        if (changes.language !== undefined) d.language = changes.language;
        if (changes.quickSummary !== undefined) d.quickSummary = changes.quickSummary;
        if (changes.standardSummary !== undefined) d.standardSummary = changes.standardSummary;
        if (changes.keyPoints !== undefined) d.keyPointsRaw = JSON.stringify(changes.keyPoints);
        if (changes.tags !== undefined) d.tagsRaw = JSON.stringify(changes.tags);
        if (changes.fileSize !== undefined) d.fileSize = changes.fileSize;
        d.updatedAt = Date.now();
      });
    });
  } catch (err) {
    console.warn('[KB] Failed to update document', documentId, err);
  }

  if (changes.status !== undefined || changes.progress !== undefined) {
    const status: KbDocStatus = effectiveStatus ?? 'queued';
    emit({
      documentId,
      status,
      progress: changes.progress ?? 0,
      label: changes.errorMessage ?? STATUS_LABELS[status],
    });
  }
}

// ─── Document creation ────────────────────────────────────────────────────────

export interface CreateDocumentInput {
  kbId: string;
  title: string;
  fileName: string;
  fileUri: string | null;
  noteId: string | null;
  sourceType: KbSourceType;
  fileSize?: number;
}

/** Inserts a queued document row. Ingestion is started separately. */
export async function createDocument(input: CreateDocumentInput): Promise<string> {
  const now = Date.now();
  let id = '';
  await database.write(async () => {
    const created = await kbDocumentsCollection.create((d: KbDocumentModel) => {
      d.kbId = input.kbId;
      d.title = input.title;
      d.sourceType = input.sourceType;
      d.fileName = input.fileName;
      d.fileUri = input.fileUri;
      d.noteId = input.noteId;
      d.fileSize = input.fileSize ?? 0;
      d.extractedText = '';
      d.pageCount = 0;
      d.status = 'queued';
      d.progress = 0;
      d.errorMessage = null;
      d.chunkCount = 0;
      d.language = null;
      d.quickSummary = null;
      d.standardSummary = null;
      d.keyPointsRaw = '[]';
      d.tagsRaw = '[]';
      d.createdAt = now;
      d.updatedAt = now;
    });
    id = created.id;
  });
  return id;
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export interface IngestOptions {
  userApiKey: string | null;
  /** Pre-extracted content, used when importing an existing note. */
  preExtracted?: { text: string; pages: string[]; pageCount: number };
  signal?: AbortSignal;
}

export interface IngestResult {
  status: KbDocStatus;
  chunkCount: number;
  embeddedCount: number;
  warnings: string[];
  error: string | null;
}

/**
 * Runs the full pipeline for one document. Never throws — the outcome is
 * reported via the returned result and persisted on the document row.
 */
export async function ingestDocument(
  documentId: string,
  options: IngestOptions,
): Promise<IngestResult> {
  const warnings: string[] = [];

  let doc: KbDocumentModel;
  try {
    doc = (await kbDocumentsCollection.find(documentId)) as KbDocumentModel;
  } catch {
    return {
      status: 'failed',
      chunkCount: 0,
      embeddedCount: 0,
      warnings,
      error: 'Document not found.',
    };
  }

  const kbId = doc.kbId;
  const fileName = doc.fileName;

  // ── 1. Extract ────────────────────────────────────────────────────────────
  await updateDoc(documentId, { status: 'extracting', progress: 5, errorMessage: null });

  let text: string;
  let pages: string[] = [];
  let pageCount = 0;

  try {
    if (options.preExtracted) {
      text = options.preExtracted.text;
      pages = options.preExtracted.pages;
      pageCount = options.preExtracted.pageCount;
    } else if (doc.fileUri) {
      const size = await getFileSize(doc.fileUri);
      const result = await extractFromFile(doc.fileUri, fileName);
      text = result.text;
      pages = result.pages;
      pageCount = result.pageCount;
      warnings.push(...result.warnings);
      await updateDoc(documentId, { fileSize: size });
    } else {
      throw new ExtractionError('This document has no file to read.', 'unreadable');
    }
  } catch (err) {
    const message =
      err instanceof ExtractionError
        ? err.message
        : "Couldn't read this document.";
    await updateDoc(documentId, { status: 'failed', progress: 0, errorMessage: message });
    return { status: 'failed', chunkCount: 0, embeddedCount: 0, warnings, error: message };
  }

  await updateDoc(documentId, {
    extractedText: text,
    pageCount,
    progress: 20,
    status: 'chunking',
  });

  // ── 2. Chunk ──────────────────────────────────────────────────────────────
  const chunks = chunkText(text, { pages });
  if (chunks.length === 0) {
    const message = "This document doesn't contain enough text to index.";
    await updateDoc(documentId, { status: 'failed', progress: 0, errorMessage: message });
    return { status: 'failed', chunkCount: 0, embeddedCount: 0, warnings, error: message };
  }

  // Replace any chunks from a previous attempt so retries don't duplicate.
  await deleteChunksForDocument(documentId);

  const now = Date.now();
  const chunkIds: string[] = [];
  await database.write(async () => {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const created = await kbChunksCollection.create((c: KbChunkModel) => {
        c.kbId = kbId;
        c.documentId = documentId;
        c.chunkIndex = i;
        c.text = chunk.text;
        c.heading = chunk.heading;
        c.page = chunk.page;
        c.charStart = chunk.charStart;
        c.charEnd = chunk.charEnd;
        c.embeddingRaw = '';
        c.createdAt = now;
      });
      chunkIds.push(created.id);
    }
  });

  await updateDoc(documentId, {
    chunkCount: chunks.length,
    progress: 30,
    status: 'embedding',
  });

  // ── 3. Embed ──────────────────────────────────────────────────────────────
  let embeddedCount = 0;
  let embedError: string | null = null;

  for (let start = 0; start < chunks.length; start += EMBED_BATCH_SIZE) {
    if (options.signal?.aborted) {
      embedError = 'Indexing was cancelled.';
      break;
    }

    const end = Math.min(start + EMBED_BATCH_SIZE, chunks.length);
    const batchTexts = chunks.slice(start, end).map((c) => {
      // Prefixing the heading gives the embedding local context, which
      // measurably improves retrieval for chunks deep inside a section.
      return c.heading ? `${c.heading}\n\n${c.text}` : c.text;
    });

    try {
      const vectors = await embedTexts(batchTexts, {
        userApiKey: options.userApiKey,
        taskType: 'RETRIEVAL_DOCUMENT',
        signal: options.signal,
      });

      await database.write(async () => {
        for (let i = 0; i < vectors.length; i++) {
          const vector = vectors[i];
          if (!vector) continue;
          const chunkId = chunkIds[start + i];
          if (!chunkId) continue;
          try {
            const model = (await kbChunksCollection.find(chunkId)) as KbChunkModel;
            await model.update((c) => { c.embeddingRaw = JSON.stringify(vector); });
            embeddedCount++;
          } catch {
            // Chunk vanished (document deleted mid-ingest) — skip it.
          }
        }
      });
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        embedError = 'Indexing was cancelled.';
        break;
      }
      embedError =
        err instanceof GeminiError
          ? err.message
          : 'Could not build the semantic index.';
      break;
    }

    const done = end / chunks.length;
    await updateDoc(documentId, { progress: 30 + Math.round(done * 50) });
  }

  // Embedding failure is not fatal: keyword search works without vectors.
  if (embeddedCount === 0 && embedError) {
    await updateDoc(documentId, {
      status: 'partial',
      progress: 100,
      errorMessage: `${embedError} Keyword search still works — retry indexing when you're back online.`,
    });
    return {
      status: 'partial',
      chunkCount: chunks.length,
      embeddedCount: 0,
      warnings,
      error: embedError,
    };
  }
  if (embedError) {
    warnings.push(
      `Only ${embeddedCount} of ${chunks.length} sections were indexed for AI search. Retry to finish.`,
    );
  }

  // ── 4. Enrich (best effort) ───────────────────────────────────────────────
  await updateDoc(documentId, { status: 'enriching', progress: 85 });

  try {
    const enrichment = await enrichDocument(
      text,
      fileName,
      options.userApiKey,
      options.signal,
    );
    await updateDoc(documentId, {
      // Keep the user's filename-derived title if the AI gave nothing better.
      title: enrichment.title || doc.title,
      language: enrichment.language,
      tags: enrichment.tags,
      quickSummary: enrichment.quickSummary,
      standardSummary: enrichment.standardSummary,
      keyPoints: enrichment.keyPoints,
    });
  } catch (err) {
    if ((err as any)?.name !== 'AbortError') {
      warnings.push('Summaries and tags could not be generated. You can retry from the document.');
    }
  }

  const finalStatus: KbDocStatus = embedError ? 'partial' : 'ready';
  await updateDoc(documentId, {
    status: finalStatus,
    progress: 100,
    errorMessage: embedError
      ? `${embeddedCount} of ${chunks.length} sections indexed. Retry to finish.`
      : null,
  });
  await touchKnowledgeBase(kbId);

  return {
    status: finalStatus,
    chunkCount: chunks.length,
    embeddedCount,
    warnings,
    error: null,
  };
}

/**
 * Re-embeds chunks that have no vector yet. Used to finish a 'partial'
 * document once the user is back online or has quota again.
 */
export async function retryEmbedding(
  documentId: string,
  options: { userApiKey: string | null; signal?: AbortSignal },
): Promise<IngestResult> {
  const pending = (await kbChunksCollection
    .query(Q.where('document_id', documentId))
    .fetch()) as KbChunkModel[];

  const missing = pending.filter((c) => !c.embedding);
  if (missing.length === 0) {
    await updateDoc(documentId, { status: 'ready', progress: 100, errorMessage: null });
    return { status: 'ready', chunkCount: pending.length, embeddedCount: pending.length, warnings: [], error: null };
  }

  await updateDoc(documentId, { status: 'embedding', progress: 30, errorMessage: null });

  let embeddedCount = 0;
  let embedError: string | null = null;

  for (let start = 0; start < missing.length; start += EMBED_BATCH_SIZE) {
    if (options.signal?.aborted) { embedError = 'Indexing was cancelled.'; break; }

    const batch = missing.slice(start, start + EMBED_BATCH_SIZE);
    const texts = batch.map((c) => (c.heading ? `${c.heading}\n\n${c.text}` : c.text));

    try {
      const vectors = await embedTexts(texts, {
        userApiKey: options.userApiKey,
        taskType: 'RETRIEVAL_DOCUMENT',
        signal: options.signal,
      });
      await database.write(async () => {
        for (let i = 0; i < vectors.length; i++) {
          const vector = vectors[i];
          if (!vector) continue;
          try {
            await batch[i].update((c) => { c.embeddingRaw = JSON.stringify(vector); });
            embeddedCount++;
          } catch { /* chunk removed */ }
        }
      });
    } catch (err) {
      embedError = err instanceof GeminiError ? err.message : 'Could not build the semantic index.';
      break;
    }

    await updateDoc(documentId, {
      progress: 30 + Math.round(((start + batch.length) / missing.length) * 65),
    });
  }

  const stillMissing = missing.length - embeddedCount;
  const status: KbDocStatus = stillMissing > 0 ? 'partial' : 'ready';
  await updateDoc(documentId, {
    status,
    progress: 100,
    errorMessage: stillMissing > 0
      ? (embedError ?? `${stillMissing} sections still need indexing.`)
      : null,
  });

  return {
    status,
    chunkCount: pending.length,
    embeddedCount,
    warnings: [],
    error: stillMissing > 0 ? embedError : null,
  };
}

/** Regenerates summaries/tags for an already-ingested document. */
export async function retryEnrichment(
  documentId: string,
  userApiKey: string | null,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const doc = (await kbDocumentsCollection.find(documentId)) as KbDocumentModel;
    if (!doc.extractedText) return false;

    await updateDoc(documentId, { status: 'enriching', progress: 90 });
    const enrichment = await enrichDocument(doc.extractedText, doc.fileName, userApiKey, signal);
    await updateDoc(documentId, {
      title: enrichment.title || doc.title,
      language: enrichment.language,
      tags: enrichment.tags,
      quickSummary: enrichment.quickSummary,
      standardSummary: enrichment.standardSummary,
      keyPoints: enrichment.keyPoints,
      status: 'ready',
      progress: 100,
      errorMessage: null,
    });
    return true;
  } catch {
    await updateDoc(documentId, { status: 'ready', progress: 100 });
    return false;
  }
}

// ─── Deletion ─────────────────────────────────────────────────────────────────

async function deleteChunksForDocument(documentId: string): Promise<void> {
  const chunks = (await kbChunksCollection
    .query(Q.where('document_id', documentId))
    .fetch()) as KbChunkModel[];
  if (chunks.length === 0) return;
  await database.write(async () => {
    await Promise.all(chunks.map((c) => c.destroyPermanently()));
  });
}

/** Deletes a document and every chunk belonging to it. */
export async function deleteDocument(documentId: string): Promise<void> {
  await deleteChunksForDocument(documentId);
  try {
    const doc = (await kbDocumentsCollection.find(documentId)) as KbDocumentModel;
    const kbId = doc.kbId;
    await database.write(async () => {
      await doc.destroyPermanently();
    });
    await touchKnowledgeBase(kbId);
  } catch {
    // Already gone.
  }
}

/** Bumps a knowledge base's updatedAt so lists re-sort sensibly. */
async function touchKnowledgeBase(kbId: string): Promise<void> {
  try {
    const kb = (await knowledgeBasesCollection.find(kbId)) as KnowledgeBaseModel;
    await database.write(async () => {
      await kb.update((k) => { k.updatedAt = Date.now(); });
    });
  } catch {
    // KB deleted — nothing to touch.
  }
}

/** Convenience: create a document from an existing note and ingest it. */
export async function ingestNote(
  kbId: string,
  note: { id: string; title: string; plainText: string },
  userApiKey: string | null,
): Promise<{ documentId: string; result: IngestResult }> {
  const extracted = extractFromNote(note);
  const documentId = await createDocument({
    kbId,
    title: note.title || 'Untitled note',
    fileName: note.title || 'Untitled note',
    fileUri: null,
    noteId: note.id,
    sourceType: 'note',
    fileSize: extracted.text.length,
  });
  const result = await ingestDocument(documentId, {
    userApiKey,
    preExtracted: {
      text: extracted.text,
      pages: extracted.pages,
      pageCount: extracted.pageCount,
    },
  });
  return { documentId, result };
}
