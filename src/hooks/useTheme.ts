import { useState, useEffect, useMemo, useCallback } from 'react';

export type ThemeMode = 'dark' | 'light' | 'system';

const STORAGE_KEY_THEME = 'repointxt_theme_mode';

export const useTheme = () => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_THEME) as ThemeMode | null;
      if (saved && (saved === 'dark' || saved === 'light' || saved === 'system')) {
        return saved;
      }
    }
    return 'dark';
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const isDark = themeMode === 'system' ? systemIsDark : themeMode === 'dark';

  useEffect(() => {
    const resolved = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', resolved);
  }, [isDark]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY_THEME, mode);
    } catch (_) {}
  }, []);

  return useMemo(() => {
    return {
      themeMode,
      setThemeMode,
      isDark,
      colors: {
        primary: 'var(--primary-text)',
        primaryButtonBg: 'var(--primary)',
        primaryLight: 'var(--primary-text)',
        primaryDark: 'var(--primary-hover)',
        secondary: 'var(--success)',
        success: 'var(--success)',
        warning: 'var(--warning-text)',
        error: 'var(--danger-text)',

        background: 'var(--bg-app)',
        card: 'var(--bg-card)',
        surface: 'var(--bg-surface)',
        recessed: 'var(--bg-recessed)',
        border: 'var(--border)',
        borderSubtle: 'var(--border-strong)',

        text: 'var(--text-main)',
        textSecondary: 'var(--text-secondary)',
        textPlaceholder: 'var(--text-muted)',

        icon: 'var(--text-main)',

        primaryGradient: 'linear-gradient(135deg, var(--primary) 0%, var(--success) 100%)',
      },
      spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48,
      },
      borderRadius: {
        sm: 4,
        md: 6,
        lg: 8,
        xl: 12,
        full: 9999,
      },
      shadows: {
        sm: { boxShadow: isDark ? '0 1px 2px rgba(0,0,0,0.8)' : '0 1px 2px rgba(0,0,0,0.05)' },
        md: { boxShadow: isDark ? '0 4px 6px rgba(0,0,0,0.8)' : '0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04)' },
        lg: { boxShadow: isDark ? '0 10px 15px rgba(0,0,0,0.9)' : '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04)' },
      }
    };
  }, [themeMode, setThemeMode, isDark]);
};
