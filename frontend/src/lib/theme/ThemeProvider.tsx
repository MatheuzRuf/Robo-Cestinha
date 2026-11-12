import { useLayoutEffect, useState, type ReactNode } from 'react';
import { ThemeContext, type Theme } from './themeContext';

const THEME_STORAGE_KEY = 'robo-cestinha-theme';

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return storedTheme === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Keep the theme usable for this page load if browser storage is unavailable.
    }
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
