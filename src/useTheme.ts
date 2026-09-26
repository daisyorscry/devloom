import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const storageKey = 'devloom.theme';
function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(storageKey);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function useTheme() {
  const [preference, setPreference] = useState<Theme | null>(savedTheme);
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const next = preference ?? (system.matches ? 'dark' : 'light');
      document.documentElement.dataset.theme = next;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', next === 'dark' ? '#181818' : '#ffffff');
      setTheme(next);
    };
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) setPreference(savedTheme());
    };
    apply();
    system.addEventListener('change', apply);
    window.addEventListener('storage', sync);
    return () => {
      system.removeEventListener('change', apply);
      window.removeEventListener('storage', sync);
    };
  }, [preference]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setPreference(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* Still works for this tab. */
    }
  };
  return { theme, toggleTheme };
}
