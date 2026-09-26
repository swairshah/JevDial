import type { ThemeMode } from '../settings';

export const THEME_ORDER: ThemeMode[] = ['system', 'light', 'dark'];

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === 'system') delete root.dataset.theme;
  else root.dataset.theme = mode;
}

export const nextTheme = (mode: ThemeMode): ThemeMode => THEME_ORDER[(THEME_ORDER.indexOf(mode) + 1) % THEME_ORDER.length];
