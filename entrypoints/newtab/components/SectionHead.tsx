import type { ReactNode } from 'react';

/** 主页各区块的标题行：标题在左，操作在右；高度固定，有没有按钮都对齐 */
export function SectionHead({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="nv-section-head nv-on-bg flex min-h-8 items-center justify-between gap-3">
      <h2 className="text-base font-medium">{title}</h2>
      {children && <div className="flex items-center gap-1 text-sm text-kumo-subtle">{children}</div>}
    </div>
  );
}
