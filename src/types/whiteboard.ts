export type BoardItemKind =
  | 'note' | 'stroke' | 'image' | 'text'
  | 'rect' | 'circle' | 'line' | 'arrow';

export type PenKind = 'pen' | 'highlighter';

export type BoardBackgroundPattern = 'plain' | 'grid' | 'dots' | 'lines';

export interface Board {
  id: string;
  name: string;
  background: string;
  /** Background pattern; 'plain' for free users. */
  pattern: BoardBackgroundPattern;
  panX: number;
  panY: number;
  zoom: number;
  /** Premium: boards can be hidden behind a PIN. */
  passcode: string | null;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

/** A point in world space — independent of pan and zoom. */
export interface Point {
  x: number;
  y: number;
}

export interface TextStyle {
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right';
}

export interface BoardItem {
  id: string;
  boardId: string;
  kind: BoardItemKind;
  /** Top-left in world space; bounding origin for strokes and lines. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Rotation in degrees, clockwise about the item's centre. */
  rotation: number;
  text: string;
  color: string;
  /** Shape fill; transparent when null. */
  fill: string | null;
  points: Point[];
  strokeWidth: number;
  /** Pen vs highlighter — highlighter draws translucent and wide. */
  pen: PenKind;
  uri: string | null;
  /** Draw order; higher sits on top. */
  z: number;
  /** Layer index; items on lower layers render first. */
  layer: number;
  /** Locked items ignore drag, resize and erase. */
  locked: boolean;
  /** Shared id for grouped items; null when ungrouped. */
  groupId: string | null;
  textStyle: TextStyle;
  createdAt: number;
  updatedAt: number;
}

export type Tool =
  | 'select' | 'pan' | 'draw' | 'highlight' | 'erase'
  | 'note' | 'text' | 'rect' | 'circle' | 'line' | 'arrow';

export interface Viewport {
  panX: number;
  panY: number;
  zoom: number;
}

/** A point-in-time snapshot of a board, for version history. */
export interface BoardVersion {
  id: string;
  boardId: string;
  label: string;
  /** JSON of BoardItem[] at capture time. */
  snapshot: string;
  itemCount: number;
  createdAt: number;
}

export interface BoardLayer {
  index: number;
  name: string;
  visible: boolean;
  itemCount: number;
}

/** Resize handle positions. */
export type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'rotate';

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 16,
  bold: false,
  italic: false,
  underline: false,
  align: 'left',
};
