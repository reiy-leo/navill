import { Children, isValidElement, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';

/**
 * 抽屉瀑布布局：按顺序把每个抽屉放进当前最矮的一列。
 * 不强求占满所有列：在能放下的列数里，选最少的那个，只要总高度不比占满全部列时明显更高。
 * 列宽固定（按最多列数计算），用不到的列留空在右侧。
 */
const MIN_COL = 300; // 最小列宽（px）
const GAP = 16; // 卡片间距（px）
const SLACK = 1.15; // 少用列时允许的总高度增幅

type Pos = { left: number; top: number };

/** 按顺序放入最矮列，返回位置与总高度 */
function pack(heights: number[], cols: number, colW: number) {
  const col = new Array(cols).fill(0);
  const pos: Pos[] = heights.map((h) => {
    let c = 0;
    for (let i = 1; i < cols; i++) if (col[i] < col[c] - 0.5) c = i;
    const p = { left: c * (colW + GAP), top: col[c] };
    col[c] += h + GAP;
    return p;
  });
  return { pos, height: Math.max(0, ...col.map((v) => v - GAP)) };
}

export function layout(heights: number[], width: number) {
  const maxCols = Math.max(1, Math.floor((width + GAP) / (MIN_COL + GAP)));
  const colW = (width - (maxCols - 1) * GAP) / maxCols;
  const full = pack(heights, Math.min(maxCols, Math.max(1, heights.length)), colW);
  for (let k = 1; k < maxCols; k++) {
    const r = pack(heights, k, colW);
    if (r.height <= full.height * SLACK) return { ...r, colW };
  }
  return { ...full, colW };
}

export function Masonry({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<{ id?: string; children: ReactNode }>[];
  const box = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<string, HTMLDivElement>());
  const [width, setWidth] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const keys = items.map((c) => String(c.key));
  useLayoutEffect(() => {
    const measure = () => setHeights((prev) => {
      const next: Record<string, number> = {};
      let changed = false;
      for (const k of keys) {
        const h = refs.current.get(k)?.offsetHeight ?? 0;
        next[k] = h;
        if (prev[k] !== h) changed = true;
      }
      return changed || Object.keys(prev).length !== keys.length ? next : prev;
    });
    measure();
    const ro = new ResizeObserver(measure);
    for (const k of keys) { const el = refs.current.get(k); if (el) ro.observe(el); }
    return () => ro.disconnect();
  }, [keys.join('|')]);

  const { pos, height, colW } = layout(keys.map((k) => heights[k] ?? 0), width || MIN_COL);
  const ready = width > 0;

  return (
    <div ref={box} className="nv-masonry relative" style={{ height }}>
      {items.map((c, i) => {
        const k = String(c.key);
        return (
          <div
            key={k}
            id={c.props.id}
            ref={(el) => { if (el) refs.current.set(k, el); else refs.current.delete(k); }}
            className="absolute"
            style={{ width: colW, left: pos[i]?.left ?? 0, top: pos[i]?.top ?? 0, visibility: ready ? undefined : 'hidden' }}
          >
            {c.props.children}
          </div>
        );
      })}
    </div>
  );
}

/** 占位：Masonry 读取它的 key、id 与 children */
export function MasonryItem(_: { id?: string; children: ReactNode }) {
  return null;
}
