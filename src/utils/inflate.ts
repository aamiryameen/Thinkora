/**
 * Minimal DEFLATE (RFC 1951) and zlib (RFC 1950) decompressor.
 *
 * React Native's Hermes engine has no zlib binding and no DecompressionStream,
 * and pulling in pako costs ~45 KB for the one thing we need: inflating PDF
 * FlateDecode streams. This is a direct implementation of the spec — fixed and
 * dynamic Huffman blocks plus stored blocks.
 *
 * Returns null on malformed input rather than throwing, so callers can fall
 * back (e.g. PDF extraction falls back to OCR).
 */

/** Code length order for the dynamic-block header, per RFC 1951 §3.2.7. */
const CODE_LENGTH_ORDER = [
  16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
];

/** Base value and extra-bit count for length codes 257–285. */
const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59,
  67, 83, 99, 115, 131, 163, 195, 227, 258,
];
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3,
  4, 4, 4, 4, 5, 5, 5, 5, 0,
];

/** Base value and extra-bit count for distance codes 0–29. */
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513,
  769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8,
  9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];

/**
 * Canonical Huffman decoding table.
 *
 * `counts[len]` = number of codes of that bit length.
 * `symbols` = symbols ordered by (code length, symbol value), which is exactly
 * the order canonical Huffman assigns codes in.
 */
interface HuffmanTable {
  counts: Int32Array;
  symbols: Int32Array;
}

const MAX_BITS = 15;

function buildHuffman(lengths: Int32Array | number[], count: number): HuffmanTable | null {
  const counts = new Int32Array(MAX_BITS + 1);
  for (let i = 0; i < count; i++) {
    counts[lengths[i]]++;
  }
  counts[0] = 0;

  // Verify the code is neither over- nor under-subscribed. An incomplete code
  // with a single symbol is legal (used for distance codes when no matches
  // occur), so allow that case through.
  let left = 1;
  for (let len = 1; len <= MAX_BITS; len++) {
    left <<= 1;
    left -= counts[len];
    if (left < 0) return null;   // over-subscribed
  }

  const offsets = new Int32Array(MAX_BITS + 2);
  for (let len = 1; len <= MAX_BITS; len++) {
    offsets[len + 1] = offsets[len] + counts[len];
  }

  const symbols = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    if (lengths[i] !== 0) {
      symbols[offsets[lengths[i]]++] = i;
    }
  }

  return { counts, symbols };
}

class BitReader {
  private pos = 0;
  private bitBuf = 0;
  private bitCount = 0;

  constructor(private readonly data: Uint8Array) {}

  /** Reads `n` bits LSB-first. Returns -1 when the input is exhausted. */
  bits(n: number): number {
    while (this.bitCount < n) {
      if (this.pos >= this.data.length) return -1;
      this.bitBuf |= this.data[this.pos++] << this.bitCount;
      this.bitCount += 8;
    }
    const value = this.bitBuf & ((1 << n) - 1);
    this.bitBuf >>>= n;
    this.bitCount -= n;
    return value;
  }

  /** Decodes one Huffman symbol. Returns -1 on malformed input. */
  decode(table: HuffmanTable): number {
    let code = 0;
    let first = 0;
    let index = 0;

    for (let len = 1; len <= MAX_BITS; len++) {
      const bit = this.bits(1);
      if (bit < 0) return -1;
      code |= bit;

      const count = table.counts[len];
      if (code - first < count) {
        return table.symbols[index + (code - first)];
      }
      index += count;
      first = (first + count) << 1;
      code <<= 1;
    }
    return -1;
  }

  /** Discards buffered bits and returns the next whole-byte offset. */
  alignToByte(): number {
    this.bitBuf = 0;
    this.bitCount = 0;
    return this.pos;
  }

  seek(pos: number) {
    this.pos = pos;
    this.bitBuf = 0;
    this.bitCount = 0;
  }

  get position(): number {
    return this.pos;
  }
}

/** Grows the output buffer geometrically; DEFLATE gives no size up front. */
class OutputBuffer {
  private buf: Uint8Array;
  private len = 0;

  constructor(initial: number) {
    this.buf = new Uint8Array(Math.max(1024, initial));
  }

  private ensure(extra: number) {
    if (this.len + extra <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }

  push(byte: number) {
    this.ensure(1);
    this.buf[this.len++] = byte;
  }

  /** Copies `length` bytes from `distance` back — the LZ77 back-reference. */
  copyBack(distance: number, length: number): boolean {
    if (distance > this.len || distance <= 0) return false;
    this.ensure(length);
    let from = this.len - distance;
    for (let i = 0; i < length; i++) {
      this.buf[this.len++] = this.buf[from++];
    }
    return true;
  }

  appendRaw(data: Uint8Array) {
    this.ensure(data.length);
    this.buf.set(data, this.len);
    this.len += data.length;
  }

  result(): Uint8Array {
    return this.buf.subarray(0, this.len);
  }

  get length(): number {
    return this.len;
  }
}

let fixedLiteralTable: HuffmanTable | null = null;
let fixedDistanceTable: HuffmanTable | null = null;

/** Builds the fixed Huffman tables from RFC 1951 §3.2.6 (cached). */
function getFixedTables(): { literal: HuffmanTable; distance: HuffmanTable } | null {
  if (!fixedLiteralTable) {
    const litLengths = new Int32Array(288);
    for (let i = 0; i < 144; i++) litLengths[i] = 8;
    for (let i = 144; i < 256; i++) litLengths[i] = 9;
    for (let i = 256; i < 280; i++) litLengths[i] = 7;
    for (let i = 280; i < 288; i++) litLengths[i] = 8;
    fixedLiteralTable = buildHuffman(litLengths, 288);

    const distLengths = new Int32Array(30).fill(5);
    fixedDistanceTable = buildHuffman(distLengths, 30);
  }
  return fixedLiteralTable && fixedDistanceTable
    ? { literal: fixedLiteralTable, distance: fixedDistanceTable }
    : null;
}

/** Reads the dynamic Huffman code lengths from a block header. */
function readDynamicTables(
  reader: BitReader,
): { literal: HuffmanTable; distance: HuffmanTable } | null {
  const hlit = reader.bits(5);
  const hdist = reader.bits(5);
  const hclen = reader.bits(4);
  if (hlit < 0 || hdist < 0 || hclen < 0) return null;

  const numLiteral = hlit + 257;
  const numDistance = hdist + 1;
  const numCodeLength = hclen + 4;

  const codeLengthLengths = new Int32Array(19);
  for (let i = 0; i < numCodeLength; i++) {
    const value = reader.bits(3);
    if (value < 0) return null;
    codeLengthLengths[CODE_LENGTH_ORDER[i]] = value;
  }

  const codeLengthTable = buildHuffman(codeLengthLengths, 19);
  if (!codeLengthTable) return null;

  // Decode the literal+distance code lengths, which are themselves
  // Huffman-coded with run-length escapes (symbols 16/17/18).
  const lengths = new Int32Array(numLiteral + numDistance);
  let i = 0;
  while (i < lengths.length) {
    const symbol = reader.decode(codeLengthTable);
    if (symbol < 0) return null;

    if (symbol < 16) {
      lengths[i++] = symbol;
      continue;
    }

    let repeat: number;
    let value = 0;
    if (symbol === 16) {
      if (i === 0) return null;          // nothing to repeat
      value = lengths[i - 1];
      const extra = reader.bits(2);
      if (extra < 0) return null;
      repeat = 3 + extra;
    } else if (symbol === 17) {
      const extra = reader.bits(3);
      if (extra < 0) return null;
      repeat = 3 + extra;
    } else {
      const extra = reader.bits(7);
      if (extra < 0) return null;
      repeat = 11 + extra;
    }

    if (i + repeat > lengths.length) return null;
    for (let r = 0; r < repeat; r++) lengths[i++] = value;
  }

  const literal = buildHuffman(lengths.subarray(0, numLiteral), numLiteral);
  const distance = buildHuffman(
    lengths.subarray(numLiteral, numLiteral + numDistance),
    numDistance,
  );
  if (!literal || !distance) return null;
  return { literal, distance };
}

/**
 * Inflates a raw DEFLATE stream (no zlib header).
 * Returns null if the stream is malformed.
 */
export function inflateRaw(data: Uint8Array): Uint8Array | null {
  const reader = new BitReader(data);
  // PDF content streams typically compress ~3-4x.
  const out = new OutputBuffer(data.length * 4);

  for (;;) {
    const isFinal = reader.bits(1);
    if (isFinal < 0) break;              // truncated: return what we have
    const blockType = reader.bits(2);
    if (blockType < 0) break;

    if (blockType === 0) {
      // Stored: LEN / NLEN then raw bytes.
      const start = reader.alignToByte();
      if (start + 4 > data.length) break;
      const len = data[start] | (data[start + 1] << 8);
      const nlen = data[start + 2] | (data[start + 3] << 8);
      if ((len ^ 0xffff) !== nlen) return out.length ? out.result() : null;
      const from = start + 4;
      const to = Math.min(from + len, data.length);
      out.appendRaw(data.subarray(from, to));
      reader.seek(to);
    } else if (blockType === 1 || blockType === 2) {
      const tables = blockType === 1 ? getFixedTables() : readDynamicTables(reader);
      if (!tables) return out.length ? out.result() : null;

      for (;;) {
        const symbol = reader.decode(tables.literal);
        if (symbol < 0) return out.length ? out.result() : null;

        if (symbol < 256) {
          out.push(symbol);
          continue;
        }
        if (symbol === 256) break;       // end of block

        const lengthIndex = symbol - 257;
        if (lengthIndex >= LENGTH_BASE.length) {
          return out.length ? out.result() : null;
        }
        const extraLenBits = LENGTH_EXTRA[lengthIndex];
        const extraLen = extraLenBits ? reader.bits(extraLenBits) : 0;
        if (extraLen < 0) return out.length ? out.result() : null;
        const length = LENGTH_BASE[lengthIndex] + extraLen;

        const distSymbol = reader.decode(tables.distance);
        if (distSymbol < 0 || distSymbol >= DIST_BASE.length) {
          return out.length ? out.result() : null;
        }
        const extraDistBits = DIST_EXTRA[distSymbol];
        const extraDist = extraDistBits ? reader.bits(extraDistBits) : 0;
        if (extraDist < 0) return out.length ? out.result() : null;
        const distance = DIST_BASE[distSymbol] + extraDist;

        if (!out.copyBack(distance, length)) {
          return out.length ? out.result() : null;
        }
      }
    } else {
      // blockType === 3 is reserved / corrupt.
      return out.length ? out.result() : null;
    }

    if (isFinal === 1) break;
  }

  return out.length ? out.result() : null;
}

/**
 * Inflates a zlib-wrapped stream (RFC 1950), auto-detecting whether the
 * 2-byte header is present. PDF FlateDecode streams are zlib-wrapped in
 * practice, but malformed producers sometimes emit raw DEFLATE.
 */
export function inflate(data: Uint8Array): Uint8Array | null {
  if (data.length < 2) return null;

  const cmf = data[0];
  const flg = data[1];
  // zlib header: low nibble of CMF is 8 (deflate), and CMF*256+FLG % 31 === 0.
  const hasZlibHeader = (cmf & 0x0f) === 8 && ((cmf << 8) | flg) % 31 === 0;

  if (hasZlibHeader) {
    // FDICT set means a preset dictionary follows, which we do not support.
    if (flg & 0x20) return null;
    const result = inflateRaw(data.subarray(2));
    if (result) return result;
  }

  // Try raw, and as a last resort skip a possibly-corrupt 2-byte header.
  return inflateRaw(data) ?? (hasZlibHeader ? null : inflateRaw(data.subarray(2)));
}
