import { Button, Tooltip } from '@cloudflare/kumo';
import { CaretLeft, CaretRight, PencilSimple, Trash, WarningCircle } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { MAX_WORKSPACES, PALETTE, db, type Workspace } from '@/src/db';
import { createWorkspace, deleteWorkspace, movePlacement, reorderWorkspaces, updateWorkspace } from '@/src/lib/store';
import { workspaceVisible } from '@/src/lib/view';
import { useContextMenu } from '@/src/ui/ContextMenu';
import { useDialogs } from '@/src/ui/dialogs';
import { useTone } from '@/src/ui/colors';
import { WorkspaceIcon } from '@/src/ui/icons';
import { useApp } from '@/src/ui/state';
import { AppMenu } from './AppMenu';
import type { Tab } from './Settings';
import { DND_PLACEMENT, DND_WORKSPACE, hasType, insertAfter } from './dnd';

export function useVisibleWorkspaces() {
  const { visibility } = useApp();
  return useLiveQuery(async () => (await db.workspaces.orderBy('order').toArray()).filter((w) => workspaceVisible(w, visibility)), [visibility]);
}

export function Nav({ current, onSearch, onSettings }: { current?: string; onSearch: () => void; onSettings: (tab?: Tab) => void }) {
  const { settings, selectWorkspace, view } = useApp();
  const workspaces = useVisibleWorkspaces() ?? [];
  const dialogs = useDialogs();
  const menu = useContextMenu();
  const top = settings.navLayout === 'top';
  const label = settings.navLabel;

  const total = useLiveQuery(() => db.workspaces.count(), []) ?? 0;
  const full = total >= MAX_WORKSPACES;
  const add = async () => {
    if (full) {
      await dialogs.confirm({ title: '工作区已满', description: `最多 ${MAX_WORKSPACES} 个工作区。可以删除不用的，或把它们合并成抽屉。`, okText: '知道了' });
      return;
    }
    const res = await dialogs.create('工作区', PALETTE[(await db.workspaces.filter((w) => w.source !== 'inbox').count()) % PALETTE.length]!);
    if (!res) return;
    const vis = await dialogs.askVisibility(settings.currentModeId, '工作区');
    if (!vis) return;
    const ws = await createWorkspace(db, { name: res.name, color: res.color, description: res.description.trim() || undefined }, vis === 'current' ? settings.currentModeId : undefined);
    selectWorkspace(ws.id);
  };

  const ctx = (e: React.MouseEvent, w: Workspace) =>
    menu(e, [
      { label: '编辑', icon: PencilSimple, onSelect: () => dialogs.editWorkspace(w.id) },
      { divider: true },
      { label: w.adult ? '取消 18+' : '标记为 18+', icon: WarningCircle, onSelect: () => void updateWorkspace(db, w.id, { adult: !w.adult }) },
      { divider: true },
      {
        label: '删除', icon: Trash, danger: true, disabled: w.source === 'inbox',
        onSelect: async () => {
          if (await dialogs.confirm({ title: `删除工作区「${w.name}」？`, description: '其中的全部抽屉与书签都会删除（有分身的书签由分身接任）。', okText: '删除', danger: true })) {
            await deleteWorkspace(db, w.id);
          }
        },
      },
    ]);

  const reorder = (dragId: string, targetId: string, after: boolean) => {
    const ids = workspaces.filter((w) => w.source !== 'inbox').map((w) => w.id).filter((id) => id !== dragId);
    const at = ids.indexOf(targetId);
    ids.splice(at < 0 ? ids.length : at + (after ? 1 : 0), 0, dragId);
    void reorderWorkspaces(db, ids);
  };

  const items = workspaces.map((w) => (
    <NavItem key={w.id} w={w} active={view === 'workspace' && w.id === current} label={label} horizontal={top}
      onClick={() => selectWorkspace(w.id)} onContextMenu={(e) => ctx(e, w)} onReorder={reorder} />
  ));

  if (top) {
    return (
      <nav className="relative flex items-center px-11 py-1">
        <ScrollStrip activeKey={view === 'workspace' ? current : undefined}>{items}</ScrollStrip>
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <AppMenu onSearch={onSearch} onSettings={onSettings} onNewWorkspace={() => void add()} />
        </div>
      </nav>
    );
  }

  return (
    <nav className={`relative flex shrink-0 flex-col px-2 py-12 ${label === 'icon' ? 'w-16 items-center' : 'w-max min-w-36 max-w-60'}`}>
      <div className="flex min-h-0 w-full flex-1 flex-col gap-0.5 overflow-y-auto [justify-content:safe_center] [scrollbar-width:none]">{items}</div>
      <div className={`absolute inset-x-0 bottom-2 flex items-center px-3 ${label === 'icon' ? 'justify-center' : ''}`}>
        <AppMenu onSearch={onSearch} onSettings={onSettings} onNewWorkspace={() => void add()} side={label === 'icon' ? 'right' : 'top'} />
      </div>
    </nav>
  );
}

/** 「仅图标」模式：选中的工作区图标放大到 1.5 倍，切换时带一下落入的动画（assets/app.css .nv-drop） */
const ICON = 22;
const ICON_BIG = 33;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FADE = 40;

/**
 * 顶部工作区条：两端有溢出时渐隐遮罩 + 悬停浮现的小箭头；滚轮纵向转横向；平滑滚动，选中项自动滚入视野。
 */
function ScrollStrip({ children, activeKey }: { children: ReactNode; activeKey?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const count = Children.count(children);
  const [edge, setEdge] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdge((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const c of el.children) ro.observe(c);
    // 纵向滚轮转横向（需要非 passive 监听才能阻止页面滚动）
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
      // 连续滚动时累加目标位置：平滑滚动途中再次 scrollBy 会从当前位置重算，导致距离被吞掉
      const max = el.scrollWidth - el.clientWidth;
      const base = target !== null && Date.now() - lastWheel < 400 ? target : el.scrollLeft;
      target = Math.max(0, Math.min(max, base + dy));
      lastWheel = Date.now();
      el.scrollTo({ left: target, behavior: Math.abs(dy) >= 50 && !reducedMotion() ? 'smooth' : 'auto' });
    };
    let target: number | null = null;
    let lastWheel = 0;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => { ro.disconnect(); el.removeEventListener('wheel', onWheel); };
  }, [measure, count]);

  // 选中的工作区平滑滚入视野（只滚这一条，不带动页面）
  useEffect(() => {
    const el = ref.current;
    const item = el?.querySelector<HTMLElement>('[data-active="true"]');
    if (!el || !item) return;
    const l = item.offsetLeft - FADE;
    const r = item.offsetLeft + item.offsetWidth + FADE - el.clientWidth;
    const to = l < el.scrollLeft ? l : r > el.scrollLeft ? r : null;
    if (to !== null) el.scrollTo({ left: Math.max(0, to), behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [activeKey]);

  const by = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.7, behavior: reducedMotion() ? 'auto' : 'smooth' });
  const mask = edge.left && edge.right
    ? `linear-gradient(to right, transparent, #000 ${FADE}px, #000 calc(100% - ${FADE}px), transparent)`
    : edge.left ? `linear-gradient(to right, transparent, #000 ${FADE}px)`
    : edge.right ? `linear-gradient(to right, #000 calc(100% - ${FADE}px), transparent)` : undefined;
  const arrow = 'absolute top-1/2 z-10 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-kumo-elevated/80 text-kumo-subtle opacity-0 shadow-sm ring-1 ring-kumo-line backdrop-blur transition duration-200 ease-out hover:text-kumo-default group-hover:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none';
  return (
    <div className="group relative min-w-0 flex-1">
      <div
        ref={ref}
        onScroll={measure}
        className="relative flex h-12 items-center gap-1 overflow-x-auto [justify-content:safe_center] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        {children}
      </div>
      {edge.left && (
        <button type="button" aria-label="向左滚动" className={`${arrow} left-0.5 -translate-x-1 group-hover:translate-x-0`} onClick={() => by(-1)}>
          <CaretLeft size={14} weight="bold" />
        </button>
      )}
      {edge.right && (
        <button type="button" aria-label="向右滚动" className={`${arrow} right-0.5 translate-x-1 group-hover:translate-x-0`} onClick={() => by(1)}>
          <CaretRight size={14} weight="bold" />
        </button>
      )}
    </div>
  );
}

function NavItem({
  w, active, label, horizontal, onClick, onContextMenu, onReorder,
}: {
  w: Workspace; active: boolean; label: 'both' | 'icon' | 'name'; horizontal: boolean;
  onClick: () => void; onContextMenu: (e: React.MouseEvent) => void; onReorder: (dragId: string, targetId: string, after: boolean) => void;
}) {
  const [over, setOver] = useState<'bookmark' | 'before' | 'after' | null>(null);
  const tone = useTone(w.color);
  const btn = (
    <button
      draggable={w.source !== 'inbox'}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_WORKSPACE, w.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        if (hasType(e, DND_PLACEMENT)) {
          e.preventDefault();
          setOver('bookmark');
        } else if (hasType(e, DND_WORKSPACE) && w.source !== 'inbox') {
          e.preventDefault();
          setOver(insertAfter(e, horizontal) ? 'after' : 'before');
        }
      }}
      onDragLeave={() => setOver(null)}
      onDrop={(e) => {
        const side = over;
        setOver(null);
        const pid = e.dataTransfer.getData(DND_PLACEMENT);
        const wid = e.dataTransfer.getData(DND_WORKSPACE);
        if (pid) void movePlacement(db, pid, w.id, null);
        else if (wid && wid !== w.id) onReorder(wid, w.id, side === 'after');
      }}
      className={`flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${horizontal ? '' : 'w-full'} ${
        active ? (label === 'icon' ? '' : 'bg-[color-mix(in_srgb,var(--nv-c)_20%,transparent)] font-medium') : 'hover:bg-[color-mix(in_srgb,var(--nv-c)_10%,transparent)]'
      } transition-colors ${over === 'bookmark' ? 'ring-2 ring-kumo-brand' : ''} ${
        over === 'before' ? (horizontal ? 'shadow-[inset_3px_0_0_var(--color-kumo-brand)]' : 'shadow-[inset_0_3px_0_var(--color-kumo-brand)]') : ''
      } ${over === 'after' ? (horizontal ? 'shadow-[inset_-3px_0_0_var(--color-kumo-brand)]' : 'shadow-[inset_0_-3px_0_var(--color-kumo-brand)]') : ''}`}
      style={{ '--nv-c': tone ?? 'var(--color-kumo-brand)' } as React.CSSProperties}
      aria-label={w.name}
      data-active={active || undefined}
    >
      {label === 'both' && <WorkspaceIcon ws={w} size={ICON} />}
      {label === 'icon' && (
        <span className="relative shrink-0 transition-[width,height] duration-200 ease-out motion-reduce:transition-none"
          style={horizontal ? { height: ICON, width: active ? ICON_BIG : ICON } : { width: ICON, height: active ? ICON_BIG : ICON }}>
          {/* 以贴边的一侧为基线放大：顶栏贴上沿向下长，侧栏贴左沿向右长 */}
          <span className={`absolute block ${horizontal ? 'left-1/2 top-0 -translate-x-1/2' : 'left-0 top-1/2 -translate-y-1/2'}`}>
            <span key={active ? 'on' : 'off'} className={`block transition-transform duration-200 ease-out motion-reduce:transition-none ${active ? 'nv-drop' : ''}`}
              style={{ transformOrigin: horizontal ? 'top center' : 'left center', transform: `scale(${active ? 1 : ICON / ICON_BIG})` }}>
              <WorkspaceIcon ws={w} size={ICON_BIG} />
            </span>
          </span>
        </span>
      )}
      {label !== 'icon' && <span className={`truncate ${horizontal ? 'max-w-40' : 'flex-1'}`}>{w.name}</span>}
      {label !== 'icon' && w.adult && <span className="text-xs text-kumo-danger">18+</span>}
    </button>
  );
  const tip = [label === 'icon' ? w.name : '', w.description].filter(Boolean).join(' · ');
  return tip ? <Tooltip content={tip} side={horizontal ? 'bottom' : 'right'}>{btn}</Tooltip> : btn;
}
