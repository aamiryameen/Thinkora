/**
 * Design system: light & dark palettes, spacing, typography, category colors,
 * and 11 custom theme color presets.
 */

import type { AppThemeId } from '../types';

export const spacing = {
  xxs: 2,
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

export const borderRadius = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const typography = {
  title: { fontSize: 22, fontWeight: '600' as const },
  titleSmall: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodySmall: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '600' as const },
  overline: { fontSize: 11, fontWeight: '600' as const },
  button: { fontSize: 15, fontWeight: '600' as const },
} as const;

export const categoryColors = {
  orange: '#F59E0B',
  blue: '#3B82F6',
  green: '#10B981',
  red: '#EF4444',
  purple: '#8B5CF6',
  pink: '#EC4899',
  teal: '#14B8A6',
  indigo: '#6366F1',
} as const;

// ─── 11 Theme Color Presets ──────────────────────────

export interface ThemeColorPreset {
  id: AppThemeId;
  name: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  accent: string;
}

export const THEME_PRESETS: ThemeColorPreset[] = [
  { id: 'default', name: 'Blue Sky', primary: '#4A90D9', primaryLight: '#EBF2FC', primaryDark: '#2E6AB0', accent: '#F59E0B' },
  { id: 'ocean', name: 'Ocean', primary: '#0891B2', primaryLight: '#ECFEFF', primaryDark: '#0E7490', accent: '#F97316' },
  { id: 'sunset', name: 'Sunset', primary: '#EA580C', primaryLight: '#FFF7ED', primaryDark: '#C2410C', accent: '#8B5CF6' },
  { id: 'forest', name: 'Forest', primary: '#059669', primaryLight: '#ECFDF5', primaryDark: '#047857', accent: '#F59E0B' },
  { id: 'berry', name: 'Berry', primary: '#7C3AED', primaryLight: '#F5F3FF', primaryDark: '#6D28D9', accent: '#EC4899' },
  { id: 'lavender', name: 'Lavender', primary: '#8B5CF6', primaryLight: '#F5F3FF', primaryDark: '#7C3AED', accent: '#F59E0B' },
  { id: 'coral', name: 'Coral', primary: '#F43F5E', primaryLight: '#FFF1F2', primaryDark: '#E11D48', accent: '#06B6D4' },
  { id: 'midnight', name: 'Midnight', primary: '#6366F1', primaryLight: '#EEF2FF', primaryDark: '#4F46E5', accent: '#F59E0B' },
  { id: 'mint', name: 'Mint', primary: '#14B8A6', primaryLight: '#F0FDFA', primaryDark: '#0D9488', accent: '#F43F5E' },
  { id: 'rose', name: 'Rose', primary: '#EC4899', primaryLight: '#FDF2F8', primaryDark: '#DB2777', accent: '#8B5CF6' },
  { id: 'amber', name: 'Amber', primary: '#D97706', primaryLight: '#FFFBEB', primaryDark: '#B45309', accent: '#7C3AED' },
];

// ─── Base Color Palette Builder ──────────────────────

function buildLightColors(preset: ThemeColorPreset) {
  return {
    primary: preset.primary,
    primaryLight: preset.primaryLight,
    primaryDark: preset.primaryDark,
    accent: preset.accent,
    accentLight: '#FEF3C7',
    background: '#F5F7FA',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    text: '#1A2138',
    textSecondary: '#5A6578',
    textMuted: '#8E99A8',
    textDisabled: '#B8C1CC',
    border: '#E3E8EF',
    borderFocus: preset.primary,
    error: '#EF4444',
    errorLight: '#FEF2F2',
    success: '#10B981',
    successLight: '#D1FAE5',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    star: '#F59E0B',
    icon: '#5A6578',
    tabBarBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    inputBg: '#F5F7FA',
  } as const;
}

function buildDarkColors(preset: ThemeColorPreset) {
  const lightenPrimary = preset.primary + 'CC';
  return {
    primary: lightenPrimary,
    primaryLight: preset.primaryDark + '30',
    primaryDark: preset.primary,
    accent: preset.accent + 'DD',
    accentLight: '#3D2E05',
    background: '#0F1219',
    surface: '#1A1F2E',
    surfaceElevated: '#242B3D',
    text: '#F0F2F5',
    textSecondary: '#A0AABB',
    textMuted: '#6B778C',
    textDisabled: '#4A5568',
    border: '#2D3548',
    borderFocus: lightenPrimary,
    error: '#F87171',
    errorLight: '#3B1515',
    success: '#34D399',
    successLight: '#0A3D2A',
    warning: '#FBBF24',
    warningLight: '#3D2E05',
    star: '#FBBF24',
    icon: '#A0AABB',
    tabBarBg: '#1A1F2E',
    cardBg: '#1A1F2E',
    inputBg: '#242B3D',
  } as const;
}

export const lightColors = buildLightColors(THEME_PRESETS[0]);
export const darkColors = buildDarkColors(THEME_PRESETS[0]);

function buildLightShadows(primary: string) {
  return {
    card: { shadowColor: primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
    fab: { shadowColor: primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
    input: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  } as const;
}

function buildDarkShadows(primary: string) {
  return {
    card: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
    fab: { shadowColor: primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 10 },
    input: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  } as const;
}

export const lightShadows = buildLightShadows(THEME_PRESETS[0].primary);
export const darkShadows = buildDarkShadows(THEME_PRESETS[0].primary);

export type ColorPalette = { [K in keyof typeof lightColors]: string };
export type ShadowStyle = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};
export type ShadowSet = { card: ShadowStyle; fab: ShadowStyle; input: ShadowStyle };
export type Theme = {
  colors: ColorPalette;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  typography: typeof typography;
  shadows: ShadowSet;
  isDark: boolean;
};

/** Build a full theme from a preset + mode */
export function buildTheme(presetId: AppThemeId, isDark: boolean): Theme {
  const preset = THEME_PRESETS.find((p) => p.id === presetId) ?? THEME_PRESETS[0];
  return {
    colors: isDark ? buildDarkColors(preset) : buildLightColors(preset),
    spacing,
    borderRadius,
    typography,
    shadows: isDark ? buildDarkShadows(preset.primary) : buildLightShadows(preset.primary),
    isDark,
  };
}

export const lightTheme: Theme = buildTheme('default', false);
export const darkTheme: Theme = buildTheme('default', true);

/** @deprecated Use useTheme() from ThemeContext for theme-aware UI */
export const theme = lightTheme;
