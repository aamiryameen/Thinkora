import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import {
  DEFAULT_TEXT_STYLE,
  type Board,
  type BoardBackgroundPattern,
  type BoardItem,
  type BoardItemKind,
  type BoardVersion,
  type PenKind,
  type Point,
  type TextStyle,
} from '../../types/whiteboard';

function parsePoints(json: string): Point[] {
  try {
    const parsed = JSON.parse(json || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is Point => p && typeof p.x === 'number' && typeof p.y === 'number',
    );
  } catch {
    return [];
  }
}

/**
 * Text styles are stored as JSON, and rows created before v8 have an empty
 * string — merge onto the default so every read yields a complete style.
 */
function parseTextStyle(json: string): TextStyle {
  try {
    const parsed = JSON.parse(json || '{}');
    return { ...DEFAULT_TEXT_STYLE, ...(parsed ?? {}) };
  } catch {
    return { ...DEFAULT_TEXT_STYLE };
  }
}

export class BoardModel extends Model {
  static table = 'boards';

  @text('name') name!: string;
  @text('background') background!: string;
  @field('pattern') pattern!: string | null;
  @field('passcode') passcode!: string | null;
  @field('archived') archived!: boolean;
  @field('pan_x') panX!: number;
  @field('pan_y') panY!: number;
  @field('zoom') zoom!: number;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;

  toPlain(): Board {
    return {
      id: this.id,
      name: this.name,
      background: this.background || '#FFFFFF',
      // Pre-v8 rows have an empty pattern; treat that as plain.
      pattern: (this.pattern || 'plain') as BoardBackgroundPattern,
      panX: this.panX,
      panY: this.panY,
      // A zero or missing zoom would collapse the canvas.
      zoom: this.zoom > 0 ? this.zoom : 1,
      passcode: this.passcode || null,
      archived: !!this.archived,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export class BoardItemModel extends Model {
  static table = 'board_items';

  @field('board_id') boardId!: string;
  @text('kind') kind!: string;
  @field('x') x!: number;
  @field('y') y!: number;
  @field('width') width!: number;
  @field('height') height!: number;
  @field('rotation') rotation!: number;
  @text('text') text!: string;
  @text('color') color!: string;
  @field('fill') fill!: string | null;
  @text('points') pointsJson!: string;
  @field('stroke_width') strokeWidth!: number;
  @field('pen') pen!: string | null;
  @field('uri') uri!: string | null;
  @field('z') z!: number;
  @field('layer') layer!: number;
  @field('locked') locked!: boolean;
  @field('group_id') groupId!: string | null;
  @text('text_style') textStyleJson!: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;

  toPlain(): BoardItem {
    return {
      id: this.id,
      boardId: this.boardId,
      kind: this.kind as BoardItemKind,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      rotation: this.rotation ?? 0,
      text: this.text,
      color: this.color,
      fill: this.fill || null,
      points: parsePoints(this.pointsJson),
      strokeWidth: this.strokeWidth,
      pen: (this.pen || 'pen') as PenKind,
      uri: this.uri ?? null,
      z: this.z,
      layer: this.layer ?? 0,
      locked: !!this.locked,
      groupId: this.groupId || null,
      textStyle: parseTextStyle(this.textStyleJson),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export class BoardVersionModel extends Model {
  static table = 'board_versions';

  @field('board_id') boardId!: string;
  @text('label') label!: string;
  @text('snapshot') snapshot!: string;
  @field('item_count') itemCount!: number;
  @field('created_at') createdAt!: number;

  toPlain(): BoardVersion {
    return {
      id: this.id,
      boardId: this.boardId,
      label: this.label,
      snapshot: this.snapshot,
      itemCount: this.itemCount,
      createdAt: this.createdAt,
    };
  }
}
