/**
 * Planner themes — visual presets applied to the planner timeline only.
 *
 * "classic" is free; everything else is premium. A theme never changes the
 * app's global palette; it only tints the planner surface, hour grid, block
 * gradients and the header, so the rest of the app stays consistent.
 */

export interface PlannerTheme {
  id: string;
  name: string;
  premium: boolean;
  /** Header gradient (top → bottom). */
  headerGradient: [string, string];
  /** Header text/icon color. */
  headerText: string;
  /** Timeline background; null = use the app theme background. */
  timelineBg: string | null;
  /** Hour grid line color (supports alpha suffix). */
  gridLine: string;
  /** Hour label color. */
  hourLabel: string;
  /** "Now" indicator color. */
  nowLine: string;
  /** Block opacity suffix appended to the block's own hex color. */
  blockAlpha: string;
  /** Corner radius used for blocks. */
  blockRadius: number;
  /** Left accent bar width on blocks. */
  accentWidth: number;
  /** Optional emoji shown next to the theme name in the picker. */
  emoji: string;
}

export const PLANNER_THEMES: PlannerTheme[] = [
  {
    id: 'classic',
    name: 'Classic',
    premium: false,
    headerGradient: ['#4A90D9', '#2E6AB0'],
    headerText: '#FFFFFF',
    timelineBg: null,
    gridLine: '#E5EAF2',
    hourLabel: '#7B8696',
    nowLine: '#EF4444',
    blockAlpha: 'E6',
    blockRadius: 12,
    accentWidth: 4,
    emoji: '🗓️',
  },
  {
    id: 'midnight',
    name: 'Midnight Focus',
    premium: true,
    headerGradient: ['#1E1B4B', '#312E81'],
    headerText: '#E0E7FF',
    timelineBg: '#0F1120',
    gridLine: '#2A2F4A',
    hourLabel: '#8B93B8',
    nowLine: '#F472B6',
    blockAlpha: 'F2',
    blockRadius: 14,
    accentWidth: 5,
    emoji: '🌙',
  },
  {
    id: 'sunrise',
    name: 'Sunrise',
    premium: true,
    headerGradient: ['#F97316', '#DB2777'],
    headerText: '#FFF7ED',
    timelineBg: '#FFFBF5',
    gridLine: '#FDE4CF',
    hourLabel: '#B4744A',
    nowLine: '#DB2777',
    blockAlpha: 'E6',
    blockRadius: 16,
    accentWidth: 4,
    emoji: '🌅',
  },
  {
    id: 'forest',
    name: 'Forest',
    premium: true,
    headerGradient: ['#065F46', '#047857'],
    headerText: '#ECFDF5',
    timelineBg: '#F6FBF8',
    gridLine: '#D3EBDF',
    hourLabel: '#4A7C64',
    nowLine: '#F59E0B',
    blockAlpha: 'E0',
    blockRadius: 10,
    accentWidth: 4,
    emoji: '🌲',
  },
  {
    id: 'paper',
    name: 'Paper Planner',
    premium: true,
    headerGradient: ['#57534E', '#44403C'],
    headerText: '#FAFAF9',
    timelineBg: '#FCFBF7',
    gridLine: '#E0DBD1',
    hourLabel: '#8A8175',
    nowLine: '#B91C1C',
    blockAlpha: 'CC',
    blockRadius: 4,
    accentWidth: 3,
    emoji: '📓',
  },
  {
    id: 'neon',
    name: 'Neon',
    premium: true,
    headerGradient: ['#4C1D95', '#0891B2'],
    headerText: '#F0FDFF',
    timelineBg: '#0B1020',
    gridLine: '#1E3A5F',
    hourLabel: '#67E8F9',
    nowLine: '#22D3EE',
    blockAlpha: 'FF',
    blockRadius: 18,
    accentWidth: 6,
    emoji: '⚡',
  },
];

export const DEFAULT_PLANNER_THEME = PLANNER_THEMES[0];

export function getPlannerTheme(id: string): PlannerTheme {
  return PLANNER_THEMES.find(t => t.id === id) ?? DEFAULT_PLANNER_THEME;
}

/**
 * Resolve the theme actually usable by this user — falls back to Classic when
 * a premium theme is selected but the entitlement has lapsed.
 */
export function resolvePlannerTheme(id: string, hasPremium: boolean): PlannerTheme {
  const theme = getPlannerTheme(id);
  return theme.premium && !hasPremium ? DEFAULT_PLANNER_THEME : theme;
}
