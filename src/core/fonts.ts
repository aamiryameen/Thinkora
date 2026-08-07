import { Platform } from 'react-native';

export interface NoteFont {
  id: string;
  label: string;
  /** Undefined uses the platform default. */
  fontFamily?: string;
  /** Applied together with the family — some faces only exist as a weight. */
  fontWeight?: '300' | '400' | '500' | '700' | '900';
  fontStyle?: 'normal' | 'italic';
  /** Nudges size so faces with different x-heights look evenly sized. */
  sizeScale?: number;
  /**
   * CSS generic used as the fallback in the rich editor.
   *
   * Declared per font rather than sniffed from `fontFamily`: the iOS name for
   * a monospace face is "Menlo", which contains no hint of being mono.
   */
  generic?: 'serif' | 'monospace' | 'cursive' | 'sans-serif';
  premium: boolean;
}

/**
 * Fonts drawn from the families Android and iOS already ship.
 *
 * Bundling .ttf files would add megabytes and licence obligations for every
 * face; the system stack already covers serif, mono, condensed and casual, and
 * renders instantly with no loading state.
 */
export const NOTE_FONTS: NoteFont[] = [
  { id: 'default', label: 'Default', premium: false },
  {
    id: 'serif', label: 'Serif', generic: 'serif', premium: false,
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
  },
  {
    id: 'serif-italic', label: 'Serif Italic', generic: 'serif', premium: false,
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
    fontStyle: 'italic',
  },
  {
    id: 'mono', label: 'Mono', generic: 'monospace', premium: false,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    sizeScale: 0.94,
  },
  {
    id: 'light', label: 'Light', premium: false,
    fontFamily: Platform.OS === 'android' ? 'sans-serif-light' : undefined,
    fontWeight: '300',
  },
  {
    id: 'bold', label: 'Bold', premium: false,
    fontWeight: '900',
  },
  // ── Premium faces ──
  {
    id: 'condensed', label: 'Condensed', generic: 'sans-serif', premium: true,
    fontFamily: Platform.OS === 'android' ? 'sans-serif-condensed' : 'AvenirNextCondensed-Regular',
  },
  {
    id: 'casual', label: 'Casual', generic: 'cursive', premium: true,
    fontFamily: Platform.OS === 'android' ? 'casual' : 'Bradley Hand',
    sizeScale: 1.06,
  },
  {
    id: 'cursive', label: 'Handwriting', generic: 'cursive', premium: true,
    fontFamily: Platform.OS === 'android' ? 'cursive' : 'Snell Roundhand',
    sizeScale: 1.08,
  },
  {
    id: 'serif-mono', label: 'Typewriter', generic: 'monospace', premium: true,
    fontFamily: Platform.OS === 'android' ? 'serif-monospace' : 'American Typewriter',
    sizeScale: 0.95,
  },
  {
    id: 'medium', label: 'Medium', premium: true,
    fontFamily: Platform.OS === 'android' ? 'sans-serif-medium' : undefined,
    fontWeight: '500',
  },
  {
    id: 'thin', label: 'Thin', premium: true,
    fontFamily: Platform.OS === 'android' ? 'sans-serif-thin' : undefined,
    fontWeight: '300',
  },
];

export const DEFAULT_FONT_ID = 'default';

export function findFont(id: string | null | undefined): NoteFont {
  return NOTE_FONTS.find(f => f.id === id) ?? NOTE_FONTS[0];
}

/** Style object for a font, ready to spread onto a Text or TextInput. */
export function fontStyle(id: string | null | undefined, baseSize?: number): {
  fontFamily?: string;
  fontWeight?: NoteFont['fontWeight'];
  fontStyle?: NoteFont['fontStyle'];
  fontSize?: number;
} {
  const font = findFont(id);
  return {
    ...(font.fontFamily ? { fontFamily: font.fontFamily } : {}),
    ...(font.fontWeight ? { fontWeight: font.fontWeight } : {}),
    ...(font.fontStyle ? { fontStyle: font.fontStyle } : {}),
    ...(baseSize
      ? { fontSize: Math.round(baseSize * (font.sizeScale ?? 1)) }
      : {}),
  };
}

/**
 * CSS font-family for the rich editor's WebView.
 *
 * The editor renders HTML, so it needs a CSS stack rather than a React Native
 * fontFamily — and a generic fallback in case the named face is absent.
 */
export function cssFontFamily(id: string | null | undefined): string {
  const font = findFont(id);
  if (!font.fontFamily) return '-apple-system, Roboto, sans-serif';

  return `"${font.fontFamily}", ${font.generic ?? 'sans-serif'}`;
}
