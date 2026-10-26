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
  lastMove = null;
  setTimeout(emit, 0);
}
export function endDrag() {
  if (state.drag) set({ drag: null, over: null });
}

if (typeof document !== 'undefined') {
  document.addEventListener('dragend', endDrag);
  // 放下后（各处理函数都跑完）再清
  document.addEventListener('drop', () => setTimeout(endDrag, 0));
  // 拖出了同类列表的范围：撤掉预览
  document.addEventListener('dragover', (e) => {
    const d = state.drag;
    if (!d || !state.over) return;
    const t = e.target as Element | null;
    // 目标节点刚被重渲染移除（比如空抽屉的「拖书签到这里」提示被占位替换）时，事件仍落在这个脱离文档的节点上，不能当作拖出
    if (t && !t.isConnected) return;
    if (!t?.closest?.(`[data-sort-kind="${d.kind}"]`)) set({ ...state, over: null });
  });
}

/**
 * 防抖：每次重排后，指针要再移动 MOVE_PX 以上、且过了 SETTLE_MS（等 FLIP 动画走完）才允许下一次重排。
 * 瀑布等大小不一的布局里，重排会把另一张卡片挪到静止的指针下，没有这道门槛就会两种排列来回闪。
 */
const MOVE_PX = 12;
const SETTLE_MS = 240;
let lastMove: { x: number; y: number; t: number } | null = null;
function settled(e: React.DragEvent) {
  if (!lastMove) return true;
  return performance.now() - lastMove.t >= SETTLE_MS && Math.hypot(e.clientX - lastMove.x, e.clientY - lastMove.y) >= MOVE_PX;
}
const markMove = (e: React.DragEvent) => { lastMove = { x: e.clientX, y: e.clientY, t: performance.now() }; };

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
  const byKey = new Map(items.map((t) => [keyOf(t), t]));
  // 只订阅与本列表相关的那一小片状态：别的列表里移动不会让本列表重渲染
  useSyncExternalStore(subscribe, () => {
    const d = state.drag;
    if (!d || d.kind !== kind) return '';
    const o = state.over;
    const here = o?.list === list ? `h${o.index}` : '';
    return byKey.has(d.id) ? `${d.id}|o|${here || (o ? 'x' : 'n')}` : `${d.id}|${here}`;
  });
  const s = state;
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

  // 处理函数在事件发生时读最新的值，所以可以缓存成稳定引用（子组件 memo 才有效）
  const live = useRef({ rows, byKey, sortable, onDrop, foreign, horizontal, list, dataSig });
  live.current = { rows, byKey, sortable, onDrop, foreign, horizontal, list, dataSig };
  const cur = () => (state.drag && state.drag.kind === kind ? state.drag : null);
  const accept = (e: React.DragEvent) => {
    const dd = cur(), L = live.current;
    return !!dd && L.sortable && !!L.onDrop && (L.byKey.has(dd.id) || !!L.foreign?.(dd.payload)) && e.dataTransfer !== null;
  };
  const rest = (cur_: SortRow<T>[], id: string) => cur_.filter((r) => r.key !== id && !r.hidden);

  const drop = (e: React.DragEvent) => {
    const dd = cur(), L = live.current;
    if (!dd || !accept(e) || state.over?.list !== L.list) return;
    e.preventDefault();
    e.stopPropagation();
    const keys = L.rows.filter((r) => !r.hidden).map((r) => r.key);
    setPending(keys);
    pendingFor.current = L.dataSig;
    L.onDrop!(dd.id, keys);
    endDrag();
  };

  const onItemOver = (key: string, e: React.DragEvent) => {
    const dd = cur(), L = live.current;
    if (!dd || !accept(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (key === dd.id) { lastTarget.current = null; return; }
    if (!settled(e)) return;
    const r = rest(L.rows, dd.id);
    const at = r.findIndex((x) => x.key === key);
    if (at < 0) return;
    const shown = L.rows.findIndex((x) => x.key === dd.id && x.ghost);
    let index: number;
    if (shown >= 0 && state.over?.list === L.list) {
      // 已在本列表里：经过谁就占谁的位置；同一目标在离开前不重复触发，避免大小不同时来回跳
      if (lastTarget.current === key) return;
      const mine = L.rows.findIndex((x) => x.key === key);
      index = shown < mine ? at + 1 : at;
    } else {
      index = insertAfter(e, L.horizontal) ? at + 1 : at;
    }
    lastTarget.current = key;
    if (state.over?.list !== L.list || state.over.index !== index) { markMove(e); set({ ...state, over: { list: L.list, index } }); }
  };

  type Handlers = { onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void; onDragStart: () => void };
  const cache = useRef(new Map<string, Handlers>());
  const payloads = useRef(new Map<string, unknown>());
  // 去掉已不在列表里的缓存
  if (cache.current.size > byKey.size + 8) for (const k of cache.current.keys()) if (!byKey.has(k)) { cache.current.delete(k); payloads.current.delete(k); }

  /** 每一项的拖放处理（目标 + 拖动源），按 key 缓存为稳定引用；payload 在拖动开始时读取 */
  const bind = (key: string, payload?: unknown): Handlers => {
    payloads.current.set(key, payload);
    let h = cache.current.get(key);
    if (!h) {
      h = {
        onDragOver: (e) => onItemOver(key, e),
        onDrop: (e) => drop(e),
        onDragStart: () => {
          lastTarget.current = null;
          startDrag({ kind, id: key, from: live.current.list, payload: payloads.current.get(key) });
        },
      };
      cache.current.set(key, h);
    }
    return h;
  };
  // 缓存的闭包引用的是首次渲染时的 onItemOver/drop，它们只通过 live / state / ref 读值，所以不会过期

  /** 列表容器（空白处）：从别处拖进来时追加到末尾 */
  const container = useRef({
    'data-sort-kind': kind,
    'data-sort-list': list,
    onDragOver: (e: React.DragEvent) => {
      const dd = cur(), L = live.current;
      if (!dd || !accept(e)) return;
      e.preventDefault();
      if (state.over?.list !== L.list) {
        // 空列表没有别的项会被挪动，不需要等动画稳定
        if (rest(L.rows, dd.id).length > 0 && !settled(e)) return;
        lastTarget.current = null;
        markMove(e);
        set({ ...state, over: { list: L.list, index: rest(L.rows, dd.id).length } });
      }
    },
    onDrop: (e: React.DragEvent) => drop(e),
  }).current;
  container['data-sort-list'] = list;

  return { rows, sig, bind, container, dragging: !!d };
}
