import React, { createContext, useState, useMemo, useEffect } from 'react';

export type ThemeType = 'dark' | 'light' | 'vibrant';

export const ThemeContext = createContext<{
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}>({
  theme: 'light',
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeType>('light');
  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const shouldUseDark = theme === 'dark' || theme === 'vibrant';
    root.classList.toggle('dark', shouldUseDark);
    try { window.localStorage.setItem('sv_theme', theme); } catch {}
  }, [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
