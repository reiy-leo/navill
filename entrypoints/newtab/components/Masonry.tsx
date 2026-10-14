import { useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * 抽屉的 Bento 瀑布布局：按 grid 行跨度排布，保持从左到右的阅读顺序，
 * 同时让较矮的卡片下方由后续卡片在垂直方向补齐空白。
 */
const ROW = 4; // grid-auto-rows 的单位高度（px）
const GAP = 16; // 卡片间距（px）

export function Masonry({ children }: { children: ReactNode }) {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] items-start"
      style={{ gridAutoRows: `${ROW}px`, columnGap: GAP, rowGap: 0 }}
    >
      {children}
    </div>
  );
}

export function MasonryItem({ id, children }: { id?: string; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const o = outer.current, i = inner.current;
    if (!o || !i) return;
    const fit = () => { o.style.gridRowEnd = `span ${Math.max(1, Math.ceil((i.getBoundingClientRect().height + GAP) / ROW))}`; };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(i);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outer} id={id}>
      <div ref={inner}>{children}</div>
    </div>
  );
}
