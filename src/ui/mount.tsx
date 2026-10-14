import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/assets/app.css';
import { followTheme } from './theme';

export function mount(node: ReactNode): void {
  followTheme();
  createRoot(document.getElementById('root')!).render(<StrictMode>{node}</StrictMode>);
}
