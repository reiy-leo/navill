import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/assets/app.css';
import { followTheme } from './theme';
import { dateLocale } from '@/src/i18n';

export function mount(node: ReactNode): void {
  followTheme();
  document.documentElement.lang = dateLocale;
  createRoot(document.getElementById('root')!).render(<StrictMode>{node}</StrictMode>);
}
