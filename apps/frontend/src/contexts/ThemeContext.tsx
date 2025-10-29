import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Read theme from localStorage, default to 'light' if not found
    const savedTheme = localStorage.getItem('cvp_theme') as Theme | null;
    const initialTheme = savedTheme || 'light';

    // Apply theme immediately during initialization to prevent flash
    const root = document.documentElement;

    // Remove ALL classes first
    root.className = '';

    // Add the theme class
    root.classList.add(initialTheme);

    return initialTheme;
  });

  useEffect(() => {
    // Apply theme to document root (HTML element) - this triggers Tailwind's dark: classes
    const root = document.documentElement;

    // Clear all theme classes first
    root.classList.remove('light', 'dark');

    // Add the current theme
    root.classList.add(theme);

    // Save to localStorage
    localStorage.setItem('cvp_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}