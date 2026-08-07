/**
 * Document text extraction for the Knowledge Base.
 *
 * Turns a picked file into plain text plus per-page text, choosing a strategy
 * per format:
 *
 *   PDF        → pure-JS text layer extraction (pdfTextService). Scanned PDFs
 *                have no text layer, so we report that and let the caller
 *                suggest the Scan flow instead.
 *   Images     → ML Kit on-device OCR (same engine as the Scan feature).
 *   TXT / MD   → read directly.
 *   CSV        → read and reflow into "column: value" lines, which embed far
 *                better than raw comma-separated rows.
 *   Notes      → read from the notes table, no file involved.
 *   DOCX/EPUB/ → recognised and rejected with a clear message. Both are ZIP
 *   PPTX         containers; supporting them needs a ZIP reader (deferred).
 *
 * Everything here is on-device and works offline.
 */

import { Platform } from 'react-native';
import type { KbSourceType } from '../types/knowledge';
import { extractPdfText, looksLikeGarbage } from './pdfTextService';

// Lazy-load native modules so Jest and any non-Android target still import.
let RNFS: {
  readFile: (path: string, encoding: string) => Promise<string>;
  stat: (path: string) => Promise<{ size: number }>;
  exists: (path: string) => Promise<boolean>;
} | null = null;
let TextRecognition: any = null;

if (Platform.OS === 'android') {
  try {
    const fs = require('react-native-fs');
    RNFS = fs.default ?? fs;
  } catch {
    RNFS = null;
  }
  try {
    const mod = require('@react-native-ml-kit/text-recognition');
    TextRecognition = mod.default;
  } catch {
    TextRecognition = null;
  }
}

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly kind:
      | 'unsupported'
      | 'unreadable'
      | 'empty'
      | 'encrypted'
      | 'scanned'
      | 'too-large'
      | 'unavailable',
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

export interface ExtractionResult {
  text: string;
  /** Per-page text for paginated sources. Empty for flat formats. */
  pages: string[];
  pageCount: number;
  sourceType: KbSourceType;
  /** Non-fatal notes for the UI, e.g. "OCR quality may be low". */
  warnings: string[];
}

/** Files above this size are rejected — extraction is synchronous JS. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Below this many characters a document isn't worth indexing. */
const MIN_USEFUL_CHARS = 20;

// ─── Format detection ─────────────────────────────────────────────────────────

const EXTENSION_TYPES: Record<string, KbSourceType> = {
  pdf: 'pdf',
  txt: 'text',
  text: 'text',
  log: 'text',
  md: 'markdown',
  markdown: 'markdown',
  mdown: 'markdown',
  csv: 'csv',
  tsv: 'csv',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  webp: 'image',
  heic: 'image',
  bmp: 'image',
  docx: 'docx',
  doc: 'docx',
  epub: 'epub',
  pptx: 'pptx',
  ppt: 'pptx',
  vtt: 'transcript',
  srt: 'transcript',
};

/** Formats accepted by the document picker. */
export const SUPPORTED_PICKER_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'image/*',
];

export function detectSourceType(fileName: string, mimeType?: string): KbSourceType {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const byExt = EXTENSION_TYPES[ext];
  if (byExt) return byExt;

  if (mimeType) {
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'text/csv') return 'csv';
    if (mimeType === 'text/markdown') return 'markdown';
    if (mimeType.startsWith('text/')) return 'text';
    if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword') return 'docx';
    if (mimeType === 'application/epub+zip') return 'epub';
    if (mimeType.includes('presentationml') || mimeType === 'application/vnd.ms-powerpoint') return 'pptx';
  }
  return 'text';
}

/** Human label used in the UI. */
export function sourceTypeLabel(type: KbSourceType): string {
  switch (type) {
    case 'pdf': return 'PDF';
    case 'text': return 'Text';
    case 'markdown': return 'Markdown';
    case 'csv': return 'Spreadsheet';
    case 'image': return 'Image';
    case 'note': return 'Note';
    case 'docx': return 'Word';
    case 'epub': return 'Book';
    case 'pptx': return 'Slides';
    case 'transcript': return 'Transcript';
  }
}

/** Ionicons name used in the UI. */
export function sourceTypeIcon(type: KbSourceType): string {
  switch (type) {
    case 'pdf': return 'document-text-outline';
    case 'image': return 'image-outline';
    case 'csv': return 'grid-outline';
    case 'markdown': return 'logo-markdown';
    case 'note': return 'reader-outline';
    case 'docx': return 'document-outline';
    case 'epub': return 'book-outline';
    case 'pptx': return 'easel-outline';
    case 'transcript': return 'mic-outline';
    case 'text':
    default: return 'document-outline';
  }
}

// ─── File reading helpers ─────────────────────────────────────────────────────

/** Strips the file:// scheme and percent-decodes, which RNFS needs. */
function toFsPath(uri: string): string {
  let path = uri;
  if (path.startsWith('file://')) path = path.slice('file://'.length);
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/** Base64 → bytes. Hermes has atob but it is slow for large payloads. */
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = (() => {
  const table = new Uint8Array(256).fill(255);
  for (let i = 0; i < B64_CHARS.length; i++) table[B64_CHARS.charCodeAt(i)] = i;
  return table;
})();

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const byteLength = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(byteLength);

  let outIndex = 0;
  let buffer = 0;
  let bitsCollected = 0;

  for (let i = 0; i < clean.length; i++) {
    const value = B64_LOOKUP[clean.charCodeAt(i)];
    if (value === 255) continue;
    buffer = (buffer << 6) | value;
    bitsCollected += 6;
    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      out[outIndex++] = (buffer >> bitsCollected) & 0xff;
    }
  }
  return outIndex === out.length ? out : out.subarray(0, outIndex);
}

async function readFileBytes(uri: string): Promise<Uint8Array> {
  if (!RNFS) {
    throw new ExtractionError('File access is unavailable on this device.', 'unavailable');
  }
  const path = toFsPath(uri);
  try {
    const base64 = await RNFS.readFile(path, 'base64');
    return base64ToBytes(base64);
  } catch (err) {
    throw new ExtractionError("Couldn't read this file. It may have been moved or deleted.", 'unreadable');
  }
}

async function readFileText(uri: string): Promise<string> {
  if (!RNFS) {
    throw new ExtractionError('File access is unavailable on this device.', 'unavailable');
  }
  const path = toFsPath(uri);
  try {
    return await RNFS.readFile(path, 'utf8');
  } catch {
    // Some files declare utf8 but contain latin-1 bytes; retry via base64.
    try {
      const bytes = await readFileBytes(uri);
      let out = '';
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        out += String.fromCharCode.apply(
          null,
          Array.from(bytes.subarray(i, Math.min(i + CHUNK, bytes.length))) as number[],
        );
      }
      return out;
    } catch {
      throw new ExtractionError("Couldn't read this file. It may have been moved or deleted.", 'unreadable');
    }
  }
}

export async function getFileSize(uri: string): Promise<number> {
  if (!RNFS) return 0;
  try {
    const stat = await RNFS.stat(toFsPath(uri));
    return stat?.size ?? 0;
  } catch {
    return 0;
  }
}

// ─── Per-format extraction ────────────────────────────────────────────────────

/**
 * Reflows CSV into labelled lines. Raw comma-separated rows embed poorly
 * because the header is far from each value; pairing them keeps meaning local.
 */
function csvToText(raw: string): string {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return '';

  const delimiter = (lines[0].match(/\t/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0)
    ? '\t'
    : ',';

  /** Splits one CSV row, honouring quoted fields containing the delimiter. */
  const splitRow = (line: string): string[] => {
    const cells: string[] = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = !inQuotes;
        continue;
      }
      if (ch === delimiter && !inQuotes) { cells.push(cell.trim()); cell = ''; continue; }
      cell += ch;
    }
    cells.push(cell.trim());
    return cells;
  };

  const header = splitRow(lines[0]);
  // Heuristic: treat row 0 as a header when no cell is purely numeric.
  const hasHeader = header.length > 1 && header.every((h) => h.length > 0 && !/^-?\d+\.?\d*$/.test(h));

  if (!hasHeader) return lines.join('\n');

  const out: string[] = [`Columns: ${header.join(', ')}`];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitRow(lines[i]);
    const pairs = header
      .map((h, idx) => (cells[idx] ? `${h}: ${cells[idx]}` : null))
      .filter(Boolean);
    if (pairs.length) out.push(`Row ${i}. ${pairs.join('; ')}`);
  }
  return out.join('\n');
}

/** Converts WebVTT/SRT subtitle files into clean prose. */
function transcriptToText(raw: string): string {
  return raw
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (t === 'WEBVTT') return false;
      if (/^\d+$/.test(t)) return false;                       // SRT cue number
      if (/^-?\d{1,2}:\d{2}(:\d{2})?[.,]\d+\s*-->/.test(t)) return false;  // timing
      return true;
    })
    .map((l) => l.trim())
    .join('\n');
}

/** Runs on-device OCR over an image. */
async function ocrImage(uri: string): Promise<string> {
  if (!TextRecognition) {
    throw new ExtractionError(
      'Text recognition is unavailable on this device, so images cannot be read.',
      'unavailable',
    );
  }
  try {
    const result = await TextRecognition.recognize(uri);
    return (result?.text ?? '').trim();
  } catch (err) {
    throw new ExtractionError("Couldn't read text from this image.", 'unreadable');
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extracts text from a file. Throws ExtractionError with a user-presentable
 * message when the document can't be indexed.
 */
export async function extractFromFile(
  uri: string,
  fileName: string,
  mimeType?: string,
): Promise<ExtractionResult> {
  const sourceType = detectSourceType(fileName, mimeType);
  const warnings: string[] = [];

  if (sourceType === 'docx' || sourceType === 'epub' || sourceType === 'pptx') {
    throw new ExtractionError(
      `${sourceTypeLabel(sourceType)} files aren't supported yet. Export as PDF or plain text and try again.`,
      'unsupported',
    );
  }

  const size = await getFileSize(uri);
  if (size > MAX_FILE_BYTES) {
    throw new ExtractionError(
      `This file is too large (${Math.round(size / 1024 / 1024)} MB). The limit is ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
      'too-large',
    );
  }

  let text = '';
  let pages: string[] = [];
  let pageCount = 0;

  switch (sourceType) {
    case 'pdf': {
      const bytes = await readFileBytes(uri);
      const result = extractPdfText(bytes);

      if (result.isEncrypted) {
        throw new ExtractionError(
          'This PDF is password-protected, so its text cannot be read.',
          'encrypted',
        );
      }
      if (result.isLikelyScanned || result.text.trim().length < MIN_USEFUL_CHARS) {
        throw new ExtractionError(
          "This PDF has no text layer — it's likely a scan. Use Scan Document to read it with OCR instead.",
          'scanned',
        );
      }
      if (looksLikeGarbage(result.text)) {
        warnings.push(
          "Some text may be garbled — this PDF uses fonts that can't be decoded cleanly.",
        );
      }
      text = result.text;
      pages = result.pages;
      pageCount = result.pageCount;
      break;
    }

    case 'image': {
      text = await ocrImage(uri);
      if (text.length < MIN_USEFUL_CHARS) {
        throw new ExtractionError(
          "No readable text was found in this image.",
          'empty',
        );
      }
      warnings.push('Text was read with OCR, so there may be small errors.');
      pages = [text];
      pageCount = 1;
      break;
    }

    case 'csv': {
      text = csvToText(await readFileText(uri));
      break;
    }

    case 'transcript': {
      text = transcriptToText(await readFileText(uri));
      break;
    }

    case 'text':
    case 'markdown':
    default: {
      text = await readFileText(uri);
      break;
    }
  }

  text = text.replace(/\r\n?/g, '\n').trim();

  if (text.length < MIN_USEFUL_CHARS) {
    throw new ExtractionError(
      "This file doesn't contain enough text to index.",
      'empty',
    );
  }

  return { text, pages, pageCount, sourceType, warnings };
}

/** Builds an extraction result from an existing Thinkora note. */
export function extractFromNote(note: { title: string; plainText: string }): ExtractionResult {
  const body = (note.plainText ?? '').trim();
  const text = note.title ? `${note.title}\n\n${body}` : body;
  return {
    text,
    pages: [],
    pageCount: 0,
    sourceType: 'note',
    warnings: [],
  };
}

/** Whether a note has enough content to be worth adding. */
export function isNoteIndexable(note: { plainText: string }): boolean {
  return (note.plainText ?? '').trim().length >= MIN_USEFUL_CHARS;
}

/**
 * Marker appended to the stored error of a scanned PDF.
 *
 * A scan has no text layer, so re-running extraction can only fail the same
 * way. The UI uses this to offer the OCR flow instead of a retry that can
 * never succeed. Kept here beside the message that carries it.
 */
export const SCANNED_ERROR_MARKER = 'no text layer';

/** True when a document failed because it is a scan and needs OCR. */
export function isScannedFailure(doc: {
  status: string;
  errorMessage: string | null;
}): boolean {
  return (
    doc.status === 'failed' &&
    (doc.errorMessage ?? '').includes(SCANNED_ERROR_MARKER)
  );
}
