import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/assets/app.css';
import { followSystemTheme } from './theme';

export function mount(node: ReactNode): void {
  followSystemTheme();
  createRoot(document.getElementById('root')!).render(<StrictMode>{node}</StrictMode>);
}
