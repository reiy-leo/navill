import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/assets/app.css';
import { followTheme } from './theme';
import { lang } from '@/src/i18n';

export function mount(node: ReactNode): void {
  followTheme();
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  createRoot(document.getElementById('root')!).render(<StrictMode>{node}</StrictMode>);
}
