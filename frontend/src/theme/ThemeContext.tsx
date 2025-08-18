import React, { createContext, useState, useMemo, useEffect } from 'react';

export type ThemeType = 'dark' | 'light' | 'vibrant';

export const ThemeContext = createContext<{
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}>({
  theme: 'dark',
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeType>('dark');
  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  useEffect(() => {
    const root = document.documentElement;
    // Treat vibrant as a dark-like theme for base UI contrast
    const shouldUseDark = theme === 'dark' || theme === 'vibrant';
    root.classList.toggle('dark', shouldUseDark);
  }, [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
