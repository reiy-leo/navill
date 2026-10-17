import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { insertAfter } from './dnd';

/**
 * 拖拽排序：拖动时其他项实时让位，被拖的项在目标位置留一个同尺寸的虚线占位，
 * 周围的项用 FLIP 平滑滑过去；松手落在占位处，取消则回到原位。
 * 仍用原生 HTML5 拖放（dataTransfer 照常带类型，导航栏等其它放置目标不受影响）。
 */
export type SortKind = 'drawer' | 'bookmark' | 'workspace';

interface Drag { kind: SortKind; id: string; from: string; payload?: unknown }
interface State { drag: Drag | null; over: { list: string; index: number } | null }

let state: State = { drag: null, over: null };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const set = (s: State) => { state = s; emit(); };
const subscribe = (f: () => void) => { subs.add(f); return () => subs.delete(f); };

/** 开始拖：状态立即记下，界面晚一帧再变，免得浏览器把占位样式截进拖拽影像 */
export function startDrag(d: Drag) {
  state = { drag: d, over: null };
  setTimeout(emit, 0);
}
export function endDrag() {
  if (state.drag) set({ drag: null, over: null });
}
export const currentDrag = () => state.drag;

if (typeof document !== 'undefined') {
  document.addEventListener('dragend', endDrag);
  // 放下后（各处理函数都跑完）再清
  document.addEventListener('drop', () => setTimeout(endDrag, 0));
  // 拖出了同类列表的范围：撤掉预览
  document.addEventListener('dragover', (e) => {
    const d = state.drag;
    if (!d || !state.over) return;
    const t = e.target as Element | null;
    if (!t?.closest?.(`[data-sort-kind="${d.kind}"]`)) set({ ...state, over: null });
  });
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** FLIP：sig 变化时，把选中的元素从旧位置平滑移到新位置 */
export function useFlip(ref: React.RefObject<HTMLElement | null>, sig: string, selector: string) {
  const snap = useRef<Map<string, DOMRect> | null>(null);
  const last = useRef(sig);
  if (last.current !== sig) {
    // 渲染阶段 DOM 还是旧的：记下每个元素当前（含动画中）的位置
    last.current = sig;
    const m = new Map<string, DOMRect>();
    ref.current?.querySelectorAll<HTMLElement>(selector).forEach((el) => { if (el.dataset.flip) m.set(el.dataset.flip, el.getBoundingClientRect()); });
    snap.current = m;
  }
  useLayoutEffect(() => {
    const prev = snap.current;
    snap.current = null;
    if (!prev || !ref.current || reduced()) return;
    ref.current.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      const p = el.dataset.flip ? prev.get(el.dataset.flip) : undefined;
      if (!p) return;
      el.getAnimations().forEach((a) => { if (a.id === 'nv-flip') a.cancel(); });
      const r = el.getBoundingClientRect();
      const dx = p.left - r.left, dy = p.top - r.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', id: 'nv-flip' });
    });
  }, [sig, ref, selector]);
}

export interface SortRow<T> { t: T; key: string; ghost: boolean; hidden: boolean }

/**
 * 一个可排序列表。list 为列表 id（跨列表拖动时用），kind 只接受同类拖动。
 * onDrop 收到被拖项 id 与放下后整个列表的 key 顺序。
 * foreign：从别的列表拖进来时，用拖动携带的 payload 生成一项用于预览。
 */
export function useSortable<T>({
  list, kind, items, keyOf, sortable = true, horizontal, foreign, onDrop,
}: {
  list: string; kind: SortKind; items: T[]; keyOf: (t: T) => string; sortable?: boolean; horizontal: boolean;
  foreign?: (payload: unknown) => T | undefined;
  onDrop?: (id: string, keys: string[]) => void;
}) {
  const s = useSyncExternalStore(subscribe, () => state);
  const lastTarget = useRef<string | null>(null);
  // 放下后到数据库新顺序回来之前，先保持预览顺序，避免闪回
  const [pending, setPending] = useState<string[] | null>(null);
  const dataSig = items.map(keyOf).join('|');
  const pendingFor = useRef('');
  if (pending && pendingFor.current !== dataSig) { pendingFor.current = ''; setPending(null); }
  useLayoutEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setPending(null), 1500);
    return () => clearTimeout(t);
  }, [pending]);

  const d = s.drag && s.drag.kind === kind ? s.drag : null;
  const byKey = new Map(items.map((t) => [keyOf(t), t]));
  let rows: SortRow<T>[];
  if (pending) {
    rows = pending.filter((k) => byKey.has(k)).map((k) => ({ t: byKey.get(k)!, key: k, ghost: false, hidden: false }));
    for (const t of items) if (!pending.includes(keyOf(t))) rows.push({ t, key: keyOf(t), ghost: false, hidden: false });
  } else {
    rows = items.map((t) => ({ t, key: keyOf(t), ghost: false, hidden: false }));
    if (d && sortable) {
      const own = byKey.get(d.id);
      const dragged = own ?? (foreign ? foreign(d.payload) : undefined);
      const overHere = s.over?.list === list;
      if (dragged && overHere) {
        const rest = rows.filter((r) => r.key !== d.id);
        rest.splice(Math.max(0, Math.min(s.over!.index, rest.length)), 0, { t: dragged, key: d.id, ghost: true, hidden: false });
        rows = rest;
      } else if (own) {
        // 原位置：没有悬停到别处时留占位；拖到别的列表时收起
        rows = rows.map((r) => (r.key === d.id ? { ...r, ghost: !s.over, hidden: !!s.over } : r));
      }
    }
  }
  const sig = rows.map((r) => r.key + (r.hidden ? '-' : '')).join('|');

  const accept = (e: React.DragEvent) => !!d && sortable && !!onDrop && (byKey.has(d.id) || !!foreign?.(d.payload)) && e.dataTransfer !== null;

  const rest = (cur: SortRow<T>[]) => cur.filter((r) => r.key !== d?.id && !r.hidden);

  const drop = (e: React.DragEvent) => {
    if (!d || !accept(e) || state.over?.list !== list) return;
    e.preventDefault();
    e.stopPropagation();
    const keys = rows.filter((r) => !r.hidden).map((r) => r.key);
    setPending(keys);
    pendingFor.current = dataSig;
    onDrop!(d.id, keys);
    endDrag();
  };

  /** 每一项上的拖放目标处理 */
  const target = (key: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!d || !accept(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (key === d.id) { lastTarget.current = null; return; }
      const r = rest(rows);
      const at = r.findIndex((x) => x.key === key);
      if (at < 0) return;
      const shown = rows.findIndex((x) => x.key === d.id && x.ghost);
      let index: number;
      if (shown >= 0 && s.over?.list === list) {
        // 已在本列表里：经过谁就占谁的位置；同一目标在离开前不重复触发，避免大小不同时来回跳
        if (lastTarget.current === key) return;
        const mine = rows.findIndex((x) => x.key === key);
        index = shown < mine ? at + 1 : at;
      } else {
        index = insertAfter(e, horizontal) ? at + 1 : at;
      }
      lastTarget.current = key;
      if (state.over?.list !== list || state.over.index !== index) set({ ...state, over: { list, index } });
    },
    onDrop: drop,
  });

  /** 列表容器（空白处）：从别处拖进来时追加到末尾 */
  const container = {
    'data-sort-kind': kind,
    'data-sort-list': list,
    onDragOver: (e: React.DragEvent) => {
      if (!d || !accept(e)) return;
      e.preventDefault();
      if (state.over?.list !== list) {
        lastTarget.current = null;
        set({ ...state, over: { list, index: rest(rows).length } });
      }
    },
    onDrop: drop,
  };

  /** 拖动源 */
  const source = (key: string, payload?: unknown) => ({
    onDragStart: () => {
      lastTarget.current = null;
      startDrag({ kind, id: key, from: list, payload });
    },
  });

  return { rows, sig, target, container, source, dragging: !!d };
}
