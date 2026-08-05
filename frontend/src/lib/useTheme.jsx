import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const THEME_KEY = 'cryptoxaf-theme';
const ThemeContext = createContext(null);

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage can throw in locked-down contexts — fall through to
    // the system preference, same degradation as index.html's bootstrap.
  }
  return systemPrefersDark() ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-color-meta')?.setAttribute('content', theme === 'dark' ? '#0B1512' : '#EDEFEA');
}

// Global, not per-page — one provider at the app root covers the customer
// and admin sides alike, matching index.html's bootstrap script (which
// only ever *reads* localStorage; this is the one place that writes it).
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Best-effort persistence — the in-memory state still updates below.
    }
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
