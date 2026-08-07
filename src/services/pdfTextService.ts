/**
 * Pure-JS PDF text extraction.
 *
 * Written by hand rather than pulling in a PDF library because the usual
 * candidates don't fit React Native: pdf.js needs DOM/Canvas APIs Hermes
 * doesn't have, and the native wrappers ship large binaries or render to
 * images rather than exposing text.
 *
 * What this handles:
 *   - Classic xref-table PDFs and cross-reference streams
 *   - FlateDecode (raw DEFLATE + zlib) content streams, inflated in JS
 *   - Text operators: Tj, TJ, ' and ", plus Td, TD, T-star and BT/ET spacing
 *   - PDFDocEncoding and UTF-16BE strings, plus \ooo octal escapes
 *   - Per-page text so citations can carry real page numbers
 *
 * What it does NOT handle (by design — these fall back to OCR):
 *   - Encrypted PDFs
 *   - Scanned/image-only PDFs, which contain no text operators at all
 *   - Exotic CID fonts with non-identity ToUnicode maps, where extracted
 *     text may be garbled; `looksLikeGarbage()` detects this so the caller
 *     can fall back to OCR.
 *
 * Extraction is best-effort: a page that fails to parse yields '' rather
 * than aborting the whole document.
 */

import { inflate } from '../utils/inflate';

export interface PdfExtractResult {
  /** Full text, pages joined by form feed so callers can split if needed. */
  text: string;
  /** Text per page, index 0 === page 1. */
  pages: string[];
  pageCount: number;
  /** True when the PDF parsed but contained (almost) no extractable text. */
  isLikelyScanned: boolean;
  /** True when the PDF is encrypted and cannot be read. */
  isEncrypted: boolean;
}

// ─── Byte helpers ─────────────────────────────────────────────────────────────

/** Latin-1 view of the bytes, so byte offsets and string indices stay aligned. */
function bytesToLatin1(bytes: Uint8Array): string {
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, Math.min(i + CHUNK, bytes.length))) as number[],
    );
  }
  return out;
}

// ─── PDF string decoding ──────────────────────────────────────────────────────

/**
 * Decodes a PDF literal string body (already stripped of its parentheses),
 * resolving backslash escapes including 3-digit octal codes.
 */
function decodeLiteralString(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = raw[++i];
    if (next === undefined) break;
    switch (next) {
      case 'n': out += '\n'; break;
      case 'r': out += '\r'; break;
      case 't': out += '\t'; break;
      case 'b': out += '\b'; break;
      case 'f': out += '\f'; break;
      case '(': out += '('; break;
      case ')': out += ')'; break;
      case '\\': out += '\\'; break;
      case '\r':
        // Line continuation; swallow an optional following \n.
        if (raw[i + 1] === '\n') i++;
        break;
      case '\n':
        break;
      default:
        if (next >= '0' && next <= '7') {
          let octal = next;
          while (octal.length < 3 && raw[i + 1] >= '0' && raw[i + 1] <= '7') {
            octal += raw[++i];
          }
          out += String.fromCharCode(parseInt(octal, 8));
        } else {
          out += next;
        }
    }
  }
  return out;
}

/** Decodes a hex string body (stripped of its angle brackets). */
function decodeHexString(raw: string): string {
  const hex = raw.replace(/[^0-9A-Fa-f]/g, '');
  let out = '';
  for (let i = 0; i + 1 < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  return out;
}

/**
 * PDF text strings may be UTF-16BE (marked by a BOM) or PDFDocEncoding.
 * We also treat a strong pattern of NUL-interleaved bytes as UTF-16BE, which
 * is common in strings produced from CID fonts.
 */
function normalizePdfText(s: string): string {
  if (s.length >= 2 && s.charCodeAt(0) === 0xfe && s.charCodeAt(1) === 0xff) {
    let out = '';
    for (let i = 2; i + 1 < s.length; i += 2) {
      out += String.fromCharCode((s.charCodeAt(i) << 8) | s.charCodeAt(i + 1));
    }
    return out;
  }

  // Heuristic UTF-16BE detection: many even-index NUL bytes.
  if (s.length >= 4) {
    let nulAtEven = 0;
    let evenCount = 0;
    for (let i = 0; i < s.length; i += 2) {
      evenCount++;
      if (s.charCodeAt(i) === 0) nulAtEven++;
    }
    if (evenCount > 1 && nulAtEven / evenCount > 0.6) {
      let out = '';
      for (let i = 0; i + 1 < s.length; i += 2) {
        const code = (s.charCodeAt(i) << 8) | s.charCodeAt(i + 1);
        if (code !== 0) out += String.fromCharCode(code);
      }
      return out;
    }
  }

  return s;
}

// ─── Content stream text extraction ───────────────────────────────────────────

/**
 * Walks a decoded content stream and pulls out text, using positioning
 * operators to decide where spaces and line breaks belong.
 */
function extractTextFromContentStream(content: string): string {
  let out = '';
  let i = 0;
  const len = content.length;

  // Track vertical movement so we can turn line advances into newlines.
  let pendingNewline = false;
  let pendingSpace = false;

  /** Reads a PDF string starting at `(` or `<`, returns [text, nextIndex]. */
  function readString(start: number): [string, number] {
    if (content[start] === '(') {
      let depth = 1;
      let j = start + 1;
      let raw = '';
      while (j < len && depth > 0) {
        const ch = content[j];
        if (ch === '\\') {
          raw += ch + (content[j + 1] ?? '');
          j += 2;
          continue;
        }
        if (ch === '(') depth++;
        else if (ch === ')') {
          depth--;
          if (depth === 0) { j++; break; }
        }
        raw += ch;
        j++;
      }
      return [normalizePdfText(decodeLiteralString(raw)), j];
    }
    if (content[start] === '<') {
      const end = content.indexOf('>', start + 1);
      if (end === -1) return ['', len];
      return [normalizePdfText(decodeHexString(content.slice(start + 1, end))), end + 1];
    }
    return ['', start + 1];
  }

  function push(text: string) {
    if (!text) return;
    if (pendingNewline) {
      if (out && !out.endsWith('\n')) out += '\n';
      pendingNewline = false;
      pendingSpace = false;
    } else if (pendingSpace) {
      if (out && !/\s$/.test(out)) out += ' ';
      pendingSpace = false;
    }
    out += text;
  }

  while (i < len) {
    const ch = content[i];

    // Skip over inline images, whose binary payload would confuse the scanner.
    if (ch === 'B' && content.startsWith('BI', i)) {
      const ei = content.indexOf('EI', i);
      i = ei === -1 ? len : ei + 2;
      continue;
    }

    // Skip comments.
    if (ch === '%') {
      const nl = content.indexOf('\n', i);
      i = nl === -1 ? len : nl + 1;
      continue;
    }

    // TJ array: [(text) -300 (more)] TJ
    if (ch === '[') {
      // Find the matching close bracket, then check the operator after it.
      let j = i + 1;
      const parts: string[] = [];
      let sawTJ = false;
      while (j < len) {
        const c = content[j];
        if (c === '(' || c === '<') {
          const [text, next] = readString(j);
          parts.push(text);
          j = next;
          continue;
        }
        if (c === ']') {
          // Peek for the TJ operator.
          let k = j + 1;
          while (k < len && /\s/.test(content[k])) k++;
          sawTJ = content.startsWith('TJ', k);
          j = sawTJ ? k + 2 : j + 1;
          break;
        }
        // Large negative numbers in a TJ array denote word gaps. The exact
        // threshold is font-dependent; -150 thousandths of an em is a
        // reliable practical cutoff for an inter-word space.
        if (c === '-' || (c >= '0' && c <= '9') || c === '.') {
          let numStr = '';
          while (j < len && /[-0-9.]/.test(content[j])) numStr += content[j++];
          const value = parseFloat(numStr);
          if (!Number.isNaN(value) && value <= -150) parts.push(' ');
          continue;
        }
        j++;
      }
      if (sawTJ) push(parts.join(''));
      i = j;
      continue;
    }

    // Standalone string followed by Tj / ' / "
    if (ch === '(' || ch === '<') {
      // `<<` starts a dictionary, not a hex string.
      if (ch === '<' && content[i + 1] === '<') {
        i += 2;
        continue;
      }
      const [text, next] = readString(i);
      let k = next;
      while (k < len && /\s/.test(content[k])) k++;

      if (content.startsWith("'", k) || content.startsWith('"', k)) {
        pendingNewline = true;
        push(text);
        i = k + 1;
        continue;
      }
      if (content.startsWith('Tj', k)) {
        push(text);
        i = k + 2;
        continue;
      }
      // A string not bound to a text operator (e.g. inside a dict) — ignore.
      i = next;
      continue;
    }

    // Positioning operators. Td/TD/T* move the text cursor; a vertical
    // component means a new line, a purely horizontal one means a gap.
    if (ch === 'T') {
      const op = content.substr(i, 2);
      if (op === 'T*') {
        pendingNewline = true;
        i += 2;
        continue;
      }
      if (op === 'Td' || op === 'TD') {
        // Look back for the two operands preceding the operator.
        const before = content.slice(Math.max(0, i - 40), i);
        const nums = before.match(/(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s*$/);
        if (nums) {
          const ty = parseFloat(nums[2]);
          if (Math.abs(ty) > 0.5) pendingNewline = true;
          else if (Math.abs(parseFloat(nums[1])) > 0.5) pendingSpace = true;
        } else {
          pendingNewline = true;
        }
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    // ET ends a text object — treat as a line break.
    if (ch === 'E' && content.startsWith('ET', i)) {
      pendingNewline = true;
      i += 2;
      continue;
    }

    i++;
  }

  return out;
}

// ─── Object / stream parsing ──────────────────────────────────────────────────

interface RawObject {
  dict: string;
  streamStart: number;
  streamEnd: number;
}

/**
 * Scans the whole file for `N G obj ... endobj` and records each object's
 * dictionary text and stream byte range.
 *
 * We scan linearly rather than following the xref table: it is far more
 * robust against the malformed and incrementally-updated PDFs that show up
 * in the wild, and we need every object anyway.
 */
function indexObjects(latin1: string): Map<number, RawObject> {
  const objects = new Map<number, RawObject>();
  const objRe = /(\d+)\s+(\d+)\s+obj\b/g;
  let match: RegExpExecArray | null;

  while ((match = objRe.exec(latin1)) !== null) {
    const objNum = parseInt(match[1], 10);
    const bodyStart = match.index + match[0].length;

    const endObj = latin1.indexOf('endobj', bodyStart);
    const streamIdx = latin1.indexOf('stream', bodyStart);

    let dict: string;
    let streamStart = -1;
    let streamEnd = -1;

    const hasStream =
      streamIdx !== -1 && (endObj === -1 || streamIdx < endObj);

    if (hasStream) {
      dict = latin1.slice(bodyStart, streamIdx);
      // Per spec, `stream` is followed by CRLF or LF.
      let s = streamIdx + 'stream'.length;
      if (latin1[s] === '\r') s++;
      if (latin1[s] === '\n') s++;
      streamStart = s;

      const endStream = latin1.indexOf('endstream', s);
      streamEnd = endStream === -1 ? (endObj === -1 ? latin1.length : endObj) : endStream;
      // Trim the EOL that precedes `endstream`.
      while (
        streamEnd > streamStart &&
        (latin1[streamEnd - 1] === '\n' || latin1[streamEnd - 1] === '\r')
      ) {
        streamEnd--;
      }
    } else {
      dict = endObj === -1 ? latin1.slice(bodyStart) : latin1.slice(bodyStart, endObj);
    }

    // Later definitions win (incremental updates append newer objects).
    objects.set(objNum, { dict, streamStart, streamEnd });
    objRe.lastIndex = endObj === -1 ? objRe.lastIndex : endObj;
  }

  return objects;
}

/** Decodes an object's stream to text, applying FlateDecode when present. */
function decodeStream(
  bytes: Uint8Array,
  latin1: string,
  obj: RawObject,
): string | null {
  if (obj.streamStart < 0 || obj.streamEnd <= obj.streamStart) return null;

  const raw = bytes.subarray(obj.streamStart, obj.streamEnd);
  const filter = /\/Filter\s*(\/\w+|\[[^\]]*\])/.exec(obj.dict)?.[1] ?? '';

  // Unsupported compression (DCT/JPX are images; they hold no text anyway).
  if (/DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode/.test(filter)) {
    return null;
  }

  if (/FlateDecode/.test(filter)) {
    const inflated = inflate(raw);
    if (!inflated) return null;
    // LZW and multi-filter chains beyond Flate are rare; if a second filter
    // remains the text scan simply won't find operators and the page is empty.
    return bytesToLatin1(inflated);
  }

  if (!filter) {
    return latin1.slice(obj.streamStart, obj.streamEnd);
  }

  // ASCIIHexDecode / ASCII85Decode are uncommon for content streams.
  if (/ASCIIHexDecode/.test(filter)) {
    return decodeHexString(latin1.slice(obj.streamStart, obj.streamEnd));
  }

  return null;
}

/** Resolves `/Contents 12 0 R` or `/Contents [12 0 R 13 0 R]` to object numbers. */
function parseContentRefs(dict: string): number[] {
  const single = /\/Contents\s+(\d+)\s+\d+\s+R/.exec(dict);
  if (single) return [parseInt(single[1], 10)];

  const arrayMatch = /\/Contents\s*\[([^\]]*)\]/.exec(dict);
  if (arrayMatch) {
    const refs: number[] = [];
    const refRe = /(\d+)\s+\d+\s+R/g;
    let m: RegExpExecArray | null;
    while ((m = refRe.exec(arrayMatch[1])) !== null) {
      refs.push(parseInt(m[1], 10));
    }
    return refs;
  }
  return [];
}

/**
 * Returns page objects in document order.
 *
 * Walks the page tree from /Root → /Pages when possible, since that is the
 * only reliable source of page ORDER. Falls back to object-number order over
 * every /Type /Page object when the tree can't be followed.
 */
function collectPageObjects(
  latin1: string,
  objects: Map<number, RawObject>,
): number[] {
  const isPage = (dict: string) => /\/Type\s*\/Page\b/.test(dict) && !/\/Type\s*\/Pages\b/.test(dict);

  // Find the catalog, then the root Pages node.
  const rootRef = /\/Root\s+(\d+)\s+\d+\s+R/.exec(latin1)?.[1];
  const rootNum = rootRef ? parseInt(rootRef, 10) : NaN;
  const catalog = Number.isNaN(rootNum) ? undefined : objects.get(rootNum);
  const pagesRef = catalog ? /\/Pages\s+(\d+)\s+\d+\s+R/.exec(catalog.dict)?.[1] : undefined;

  if (pagesRef) {
    const ordered: number[] = [];
    const seen = new Set<number>();

    const walk = (num: number, depth: number) => {
      if (depth > 64 || seen.has(num)) return;   // guard against cyclic /Kids
      seen.add(num);
      const node = objects.get(num);
      if (!node) return;

      if (isPage(node.dict)) {
        ordered.push(num);
        return;
      }

      const kidsMatch = /\/Kids\s*\[([\s\S]*?)\]/.exec(node.dict);
      if (!kidsMatch) return;
      const refRe = /(\d+)\s+\d+\s+R/g;
      let m: RegExpExecArray | null;
      while ((m = refRe.exec(kidsMatch[1])) !== null) {
        walk(parseInt(m[1], 10), depth + 1);
      }
    };

    walk(parseInt(pagesRef, 10), 0);
    if (ordered.length) return ordered;
  }

  // Fallback: every page object, in ascending object number.
  const pages: number[] = [];
  for (const [num, obj] of objects) {
    if (isPage(obj.dict)) pages.push(num);
  }
  return pages.sort((a, b) => a - b);
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

function cleanupText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    // Drop control characters that survive decoding, keeping \n and \t.
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Rejoin words split across a line break by hyphenation.
    .replace(/(\p{Ll})-\n(\p{Ll})/gu, '$1$2')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Detects mojibake from unsupported CID font encodings. Real text is mostly
 * letters, digits, spaces and punctuation; garbled output skews heavily to
 * symbols and unmapped code points.
 */
export function looksLikeGarbage(text: string): boolean {
  const sample = text.slice(0, 4000);
  if (sample.length < 40) return false;

  let readable = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    const isLetterOrDigit =
      (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c > 0x00c0;
    const isCommon = c === 32 || c === 10 || c === 9 || (c >= 33 && c <= 47) || (c >= 58 && c <= 64);
    if (isLetterOrDigit || isCommon) readable++;
  }
  return readable / sample.length < 0.75;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Extracts text from PDF bytes. Never throws for malformed input — returns
 * empty pages and lets the caller decide whether to fall back to OCR.
 */
export function extractPdfText(bytes: Uint8Array): PdfExtractResult {
  const latin1 = bytesToLatin1(bytes);

  // Encrypted PDFs need RC4/AES with the document key; unsupported.
  // /Encrypt in the trailer is the reliable marker.
  const isEncrypted = /\/Encrypt\s+\d+\s+\d+\s+R/.test(latin1);
  if (isEncrypted) {
    return { text: '', pages: [], pageCount: 0, isLikelyScanned: false, isEncrypted: true };
  }

  const objects = indexObjects(latin1);
  const pageNums = collectPageObjects(latin1, objects);

  const pages: string[] = [];
  for (const pageNum of pageNums) {
    const page = objects.get(pageNum);
    if (!page) {
      pages.push('');
      continue;
    }
    let pageText = '';
    try {
      for (const ref of parseContentRefs(page.dict)) {
        const streamObj = objects.get(ref);
        if (!streamObj) continue;
        const content = decodeStream(bytes, latin1, streamObj);
        if (!content) continue;
        const extracted = extractTextFromContentStream(content);
        if (extracted) pageText += (pageText ? '\n' : '') + extracted;
      }
    } catch {
      // Keep whatever this page yielded before failing.
    }
    pages.push(cleanupText(pageText));
  }

  const text = pages.join('\n\f\n').trim();
  const totalChars = pages.reduce((n, p) => n + p.length, 0);

  return {
    text,
    pages,
    pageCount: pages.length,
    // Fewer than ~20 chars per page means there is no real text layer.
    isLikelyScanned: pages.length > 0 && totalChars / pages.length < 20,
    isEncrypted: false,
  };
}
