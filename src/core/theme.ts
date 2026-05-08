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
  xxs: 6,
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 9999,
} as const;

export const typography = {
  display:     { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.4 },
  title:       { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  titleSmall:  { fontSize: 18, fontWeight: '600' as const, letterSpacing: -0.1 },
  body:        { fontSize: 16, fontWeight: '400' as const },
  bodySmall:   { fontSize: 14, fontWeight: '400' as const },
  caption:     { fontSize: 13, fontWeight: '500' as const },
  label:       { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.2 },
  overline:    { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.6 },
  button:      { fontSize: 15, fontWeight: '600' as const, letterSpacing: 0.1 },
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
    background: '#F7F8FB',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceMuted: '#F1F3F8',
    text: '#0F1729',
    textSecondary: '#475569',
    textMuted: '#7B8696',
    textDisabled: '#B8C1CC',
    border: '#E5EAF2',
    borderSubtle: '#EEF1F6',
    borderFocus: preset.primary,
    error: '#EF4444',
    errorLight: '#FEF2F2',
    success: '#10B981',
    successLight: '#D1FAE5',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    star: '#F59E0B',
    icon: '#475569',
    tabBarBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    inputBg: '#F1F3F8',
    chipBg: 'rgba(15,23,41,0.06)',
    overlay: 'rgba(15,23,41,0.45)',
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
    background: '#0B0E16',
    surface: '#161B27',
    surfaceElevated: '#202738',
    surfaceMuted: '#1B2030',
    text: '#F1F4F8',
    textSecondary: '#AFBAC9',
    textMuted: '#7A8597',
    textDisabled: '#4A5568',
    border: '#2A3142',
    borderSubtle: '#222838',
    borderFocus: lightenPrimary,
    error: '#F87171',
    errorLight: '#3B1515',
    success: '#34D399',
    successLight: '#0A3D2A',
    warning: '#FBBF24',
    warningLight: '#3D2E05',
    star: '#FBBF24',
    icon: '#AFBAC9',
    tabBarBg: '#161B27',
    cardBg: '#161B27',
    inputBg: '#1F2536',
    chipBg: 'rgba(255,255,255,0.06)',
    overlay: 'rgba(0,0,0,0.55)',
  } as const;
}

export const lightColors = buildLightColors(THEME_PRESETS[0]);
export const darkColors = buildDarkColors(THEME_PRESETS[0]);

function buildLightShadows(primary: string) {
  return {
    subtle:   { shadowColor: '#0F1729', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6,  elevation: 1 },
    card:     { shadowColor: primary,   shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 3 },
    elevated: { shadowColor: '#0F1729', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 22, elevation: 8 },
    fab:      { shadowColor: primary,   shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 10 },
    input:    { shadowColor: '#000',    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2,  elevation: 1 },
  } as const;
}

function buildDarkShadows(primary: string) {
  return {
    subtle:   { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.20, shadowRadius: 4,  elevation: 1 },
    card:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 10, elevation: 6 },
    elevated: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.40, shadowRadius: 18, elevation: 10 },
    fab:      { shadowColor: primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.40, shadowRadius: 14, elevation: 12 },
    input:    { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.20, shadowRadius: 4,  elevation: 2 },
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
export type ShadowSet = {
  subtle: ShadowStyle;
  card: ShadowStyle;
  elevated: ShadowStyle;
  fab: ShadowStyle;
  input: ShadowStyle;
};
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
