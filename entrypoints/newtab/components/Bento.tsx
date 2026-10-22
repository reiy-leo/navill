import { useElementWidth } from '@/src/ui/useElementWidth';
import { useRef, type ReactNode } from 'react';
import type { ViewMode } from '@/src/db';

/** 便当排列：120px 网格，每个抽屉按内容多少和视图占一块 c×r 的区域，内容超出时在抽屉内滚动 */
export const CELL = 120;
export const GAP = 12;
const MAX_COLS = 6;
const MAX_ROWS = 5;
/** 各视图下一个书签（含间距）的大致宽高；行视图占满整行 */
const ITEM: Record<ViewMode, { w: number; h: number }> = {
  icon: { w: 80, h: 88 }, row: { w: 0, h: 32 }, tile: { w: 178, h: 58 }, bento: { w: 178, h: 72 },
};

/** 选一个接近方形、能装下内容的跨度 */
export function bentoSpan(count: number, view: ViewMode, head: number, gridCols: number, cellW = CELL) {
  const it = ITEM[view];
  let best = { c: 1, r: 1, score: Infinity };
  for (let c = view === 'icon' ? 1 : 2; c <= Math.max(1, Math.min(MAX_COLS, gridCols)); c++) {
    const inner = c * cellW + (c - 1) * GAP - 16;
    const perRow = it.w ? Math.max(1, Math.floor((inner + 4) / it.w)) : 1;
    const rows = Math.ceil(Math.max(1, count) / perRow);
    const h = rows * it.h + 16 + head;
    const r = Math.min(MAX_ROWS, Math.max(1, Math.ceil((h + GAP) / (CELL + GAP) - 0.15)));
    const score = Math.abs(r - c) + (h > MAX_ROWS * (CELL + GAP) ? 0 : 0.01 * c);
    if (score < best.score) best = { c, r, score };
  }
  return { c: Math.min(best.c, Math.max(1, gridCols)), r: best.r };
}

export function Bento({ items, head }: { items: { key: string; id?: string; count: number; view: ViewMode; node: ReactNode }[]; head: number }) {
  const box = useRef<HTMLDivElement>(null);
  const width = useElementWidth(box);
  const cols = Math.max(1, Math.floor((width + GAP) / (CELL + GAP)));
  const cellW = width ? (width - (cols - 1) * GAP) / cols : CELL;
  return (
    <div ref={box} className="nv-masonry grid grid-flow-dense" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: CELL, gap: GAP, visibility: width ? undefined : 'hidden' }}>
      {items.map((it) => {
        const { c, r } = bentoSpan(it.count, it.view, head, cols, cellW);
        return <div key={it.key} id={it.id} className="min-h-0 min-w-0" style={{ gridColumn: `span ${c}`, gridRow: `span ${r}` }}>{it.node}</div>;
      })}
    </div>
  );
}
