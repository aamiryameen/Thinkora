/**
 * AI Knowledge Base types.
 *
 * A KnowledgeBase groups KbDocuments. Each document is split into KbChunks,
 * and each chunk carries an embedding vector so semantic search can run
 * entirely on-device (cosine similarity in JS over locally stored vectors).
 *
 * Chat lives in KbMessage rows scoped to a knowledge base, which gives the
 * assistant conversation memory per KB without any server-side state.
 */

// ─── Knowledge Base ───────────────────────────────────────────────────────────

export interface KnowledgeBase {
  id: string;
  name: string;
  /** Ionicons name, e.g. 'briefcase-outline'. */
  icon: string;
  color: string;
  /** Optional user-facing purpose; also fed to the AI as system context. */
  description: string;
  documentCount: number;
  createdAt: number;
  updatedAt: number;
}

/** Starter knowledge bases offered on the empty state. */
export interface KbPreset {
  name: string;
  icon: string;
  color: string;
  description: string;
}

// ─── Documents ────────────────────────────────────────────────────────────────

export type KbSourceType =
  | 'pdf'
  | 'text'
  | 'markdown'
  | 'csv'
  | 'image'
  | 'note'
  | 'docx'
  | 'epub'
  | 'pptx'
  | 'transcript';

/**
 * Ingestion lifecycle. A document is only searchable once `ready`.
 * `partial` means text extraction and chunking succeeded but embeddings
 * failed (offline / quota) — keyword search works, semantic does not.
 */
export type KbDocStatus =
  | 'queued'
  | 'extracting'
  | 'chunking'
  | 'embedding'
  | 'enriching'
  | 'ready'
  | 'partial'
  | 'failed';

export interface KbDocument {
  id: string;
  kbId: string;
  /** User-visible name; defaults to the filename, AI may refine it. */
  title: string;
  sourceType: KbSourceType;
  /** Original filename, or the note title when sourceType is 'note'. */
  fileName: string;
  /** Local file URI. Null for 'note' sources, which read from the notes table. */
  fileUri: string | null;
  /** Source note id when this document was imported from a Thinkora note. */
  noteId: string | null;
  fileSize: number;
  /** Full extracted plain text. Kept so offline keyword search and re-chunking work. */
  extractedText: string;
  /** Page count for paginated sources (PDF); 0 when not applicable. */
  pageCount: number;
  status: KbDocStatus;
  /** 0–100. Drives the live progress UI during ingestion. */
  progress: number;
  /** Human-readable failure reason when status is 'failed' or 'partial'. */
  errorMessage: string | null;
  chunkCount: number;
  /** BCP-47-ish language code detected from the text, e.g. 'en'. */
  language: string | null;
  /** AI-generated summaries at increasing depth. */
  quickSummary: string | null;
  standardSummary: string | null;
  keyPoints: string[];
  /** AI-assigned topic tags. */
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

// ─── Chunks ───────────────────────────────────────────────────────────────────

export interface KbChunk {
  id: string;
  kbId: string;
  documentId: string;
  /** Position of this chunk within its document, 0-based. */
  chunkIndex: number;
  text: string;
  /** Nearest preceding heading, used for citation display. */
  heading: string | null;
  /** 1-based page number for paginated sources; null otherwise. */
  page: number | null;
  /** Character offset of this chunk in the document's extractedText. */
  charStart: number;
  charEnd: number;
  /**
   * Embedding vector. Null when the chunk was indexed offline and still
   * needs a backfill pass. Stored as JSON in SQLite.
   */
  embedding: number[] | null;
  createdAt: number;
}

/** A chunk plus its relevance score, produced by search. */
export interface KbSearchHit {
  chunk: KbChunk;
  document: KbDocument;
  /** 0–1. Cosine similarity for semantic hits, heuristic score for keyword. */
  score: number;
  matchType: 'semantic' | 'keyword';
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface KbCitation {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  heading: string | null;
  page: number | null;
  /** The exact chunk excerpt the answer drew on. */
  excerpt: string;
  /**
   * The [n] marker the model actually emitted for this source.
   *
   * Citations are compacted to only the sources the answer used, so a
   * citation's position in the array is NOT its marker number — an answer
   * citing [3] and [7] yields a 2-item array. The UI must match inline
   * markers to citations via this field, never by array index.
   */
  sourceRef: number;
}

export interface KbMessage {
  id: string;
  kbId: string;
  role: 'user' | 'assistant';
  content: string;
  citations: KbCitation[];
  /** Set when the assistant turn failed, so the UI can offer a retry. */
  error: string | null;
  createdAt: number;
}

// ─── Ingestion progress ───────────────────────────────────────────────────────

/** Emitted during ingestion so screens can render live progress. */
export interface KbIngestProgress {
  documentId: string;
  status: KbDocStatus;
  progress: number;
  /** Short label for the current step, e.g. 'Generating embeddings'. */
  label: string;
}

// ─── Explain / rewrite presets ────────────────────────────────────────────────

export type KbExplainMode =
  | 'simple'
  | 'eli10'
  | 'step-by-step'
  | 'examples'
  | 'beginner'
  | 'technical'
  | 'analogy';

export const KB_EXPLAIN_LABELS: Record<KbExplainMode, string> = {
  simple: 'Explain in simple English',
  eli10: "Explain like I'm 10",
  'step-by-step': 'Explain step-by-step',
  examples: 'Give practical examples',
  beginner: 'Make it beginner friendly',
  technical: 'Explain technically',
  analogy: 'Create an analogy',
};
