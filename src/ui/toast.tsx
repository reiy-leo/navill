import { CircleAlert, CircleCheck, CircleX, Info } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { ToastPosition, ToastStyle } from '@/src/lib/settings';

/** 轻量提醒：模块级队列，任何地方调用 toast() 即可；<Toaster> 按设置决定位置与样式 */
export type ToastType = 'success' | 'info' | 'warning' | 'error';
interface ToastItem { id: number; text: string; type: ToastType; group?: string; count: number; format?: (n: number) => string }

const DURATION = 2800;
let items: ToastItem[] = [];
let seq = 0;
const subs = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const notify = () => { for (const s of subs) s(); };

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  clearTimeout(timers.get(id));
  timers.delete(id);
  notify();
}

function arm(id: number) {
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => dismissToast(id), DURATION));
}

/**
 * 弹出一条提醒。传 group 时，短时间内同组的提醒合并为一条，用 format(n) 显示数量
 * （整理模式里批量移动 / 删除不会刷屏）。
 */
export function toast(text: string, opts: { type?: ToastType; group?: string; format?: (n: number) => string } = {}) {
  const same = opts.group ? items.find((t) => t.group === opts.group) : undefined;
  if (same) {
    same.count++;
    same.text = same.format ? same.format(same.count) : text;
    items = [...items];
    arm(same.id);
  } else {
    const t: ToastItem = { id: ++seq, text, type: opts.type ?? 'success', group: opts.group, count: 1, format: opts.format };
    items = [...items, t].slice(-4);
    arm(t.id);
  }
  notify();
}

const subscribe = (fn: () => void) => { subs.add(fn); return () => subs.delete(fn); };
const get = () => items;

const POS: Record<ToastPosition, string> = {
  'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
  'top-right': 'top-4 right-4 items-end',
  'top-left': 'top-4 left-4 items-start',
  'bottom-center': 'bottom-20 left-1/2 -translate-x-1/2 items-center flex-col-reverse',
  'bottom-right': 'bottom-4 right-4 items-end flex-col-reverse',
  'bottom-left': 'bottom-4 left-4 items-start flex-col-reverse',
};

const ICON = { success: CircleCheck, info: Info, warning: CircleAlert, error: CircleX };
const ICON_COLOR: Record<ToastType, string> = {
  success: 'text-kumo-success', info: 'text-kumo-info', warning: 'text-kumo-warning', error: 'text-kumo-danger',
};
const TINT: Record<ToastType, string> = {
  success: 'bg-kumo-success-tint ring-kumo-success/40',
  info: 'bg-kumo-info-tint ring-kumo-info/40',
  warning: 'bg-kumo-warning-tint ring-kumo-warning/40',
  error: 'bg-kumo-danger-tint ring-kumo-danger/40',
};

function boxClass(style: ToastStyle, type: ToastType): string {
  const base = 'pointer-events-auto flex max-w-sm cursor-pointer items-center gap-2 text-sm shadow-lg';
  switch (style) {
    case 'tinted': return `${base} rounded-lg px-3.5 py-2.5 text-kumo-default ring-1 ${TINT[type]}`;
    case 'dark': return `${base} rounded-lg bg-neutral-900/95 px-3.5 py-2.5 text-white ring-1 ring-white/10`;
    case 'pill': return `${base} rounded-full bg-kumo-elevated px-4 py-1.5 text-kumo-default ring-1 ring-kumo-line`;
    default: return `${base} rounded-lg bg-kumo-elevated px-3.5 py-2.5 text-kumo-default ring-1 ring-kumo-line`;
  }
}

export function Toaster({ position, style }: { position: ToastPosition; style: ToastStyle }) {
  const list = useSyncExternalStore(subscribe, get, get);
  if (!list.length) return null;
  return createPortal(
    <div className={`pointer-events-none fixed z-[1000] flex gap-2 ${POS[position]}`} role="status" aria-live="polite">
      {list.map((t) => {
        const Icon = ICON[t.type];
        return (
          <div key={t.id} className={boxClass(style, t.type)} onClick={() => dismissToast(t.id)}>
            <Icon size={20} className={`shrink-0 ${style === 'dark' ? '' : ICON_COLOR[t.type]}`} />
            <span className="min-w-0">{t.text}</span>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
