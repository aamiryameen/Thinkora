import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../core/constants';
import { buildTheme, type Theme } from '../core/theme';
import type { AppThemeId } from '../types';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
  themeColorId: AppThemeId;
  setThemeColorId: (id: AppThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [themeColorId, setThemeColorIdState] = useState<AppThemeId>('berry');

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.THEME),
      AsyncStorage.getItem(STORAGE_KEYS.THEME + '/color'),
    ]).then(([mode, colorId]) => {
      if (mode === 'light' || mode === 'dark' || mode === 'system') setThemeModeState(mode);
      if (colorId) setThemeColorIdState(colorId as AppThemeId);
    });
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(STORAGE_KEYS.THEME, mode);
  }, []);

  const setThemeColorId = useCallback((id: AppThemeId) => {
    setThemeColorIdState(id);
    AsyncStorage.setItem(STORAGE_KEYS.THEME + '/color', id);
  }, []);

  const isDark = useMemo(() => {
    return themeMode === 'system' ? systemColorScheme === 'dark' : themeMode === 'dark';
  }, [themeMode, systemColorScheme]);

  const theme = useMemo<Theme>(() => buildTheme(themeColorId, isDark), [themeColorId, isDark]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, themeMode, setThemeMode, isDark, themeColorId, setThemeColorId }),
    [theme, themeMode, setThemeMode, isDark, themeColorId, setThemeColorId]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
