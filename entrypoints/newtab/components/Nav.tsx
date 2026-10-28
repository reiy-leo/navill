import { Tooltip } from '@cloudflare/kumo';
import { CaseSensitive, CircleAlert, House, Pencil, Shapes, Share2, Smile, Trash2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Children, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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
import { DND_PLACEMENT, DND_WORKSPACE, hasType } from './dnd';
import { useFlip, useSortable } from './sortable';

import { tr } from '@/src/i18n';
export function useVisibleWorkspaces() {
  const { visibility } = useApp();
  return useLiveQuery(async () => (await db.workspaces.orderBy('order').toArray()).filter((w) => workspaceVisible(w, visibility)), [visibility]);
}

export function Nav({ current, onSearch, onSettings }: { current?: string; onSearch: () => void; onSettings: (tab?: Tab) => void }) {
  const { settings, updateSettings, selectWorkspace, view, setView } = useApp();
  const workspaces = useVisibleWorkspaces() ?? [];
  const dialogs = useDialogs();
  const menu = useContextMenu();
  const pos = settings.navPosition;
  const top = pos === 'top' || pos === 'bottom';
  const right = pos === 'right';
  const bottom = pos === 'bottom';
  const label = settings.navLabel;
  const navRef = useRef<HTMLElement>(null);
  const sort = useSortable({
    list: 'workspaces', kind: 'workspace', items: workspaces.filter((w) => w.source !== 'inbox'), keyOf: (w) => w.id, horizontal: top,
    onDrop: (_, ids) => void reorderWorkspaces(db, ids),
  });
  useFlip(navRef, sort.sig, '[data-flip-ws]');

  const total = useLiveQuery(() => db.workspaces.count(), []) ?? 0;
  const full = total >= MAX_WORKSPACES;
  const add = async () => {
    if (full) {
      await dialogs.confirm({ title: tr('工作区已满'), description: tr('最多 {0} 个工作区。可以删除不用的，或把它们合并成抽屉。', MAX_WORKSPACES), okText: tr('知道了') });
      return;
    }
    const res = await dialogs.create(tr('工作区'), PALETTE[(await db.workspaces.filter((w) => w.source !== 'inbox').count()) % PALETTE.length]!);
    if (!res) return;
    const vis = await dialogs.askVisibility(settings.currentModeId, tr('工作区'));
    if (!vis) return;
    const ws = await createWorkspace(db, { name: res.name, color: res.color, description: res.description.trim() || undefined, emoji: res.emoji || undefined, lucide: res.lucide, glyph: res.glyph || undefined }, vis === 'current' ? settings.currentModeId : undefined);
    selectWorkspace(ws.id);
  };

  const ctx = (e: React.MouseEvent, w: Workspace) =>
    menu(e, [
      { label: tr('编辑'), icon: Pencil, onSelect: () => dialogs.editWorkspace(w.id) },
      { label: tr('分享…'), icon: Share2, onSelect: () => dialogs.share('workspace', w.id, w.name) },
      { divider: true },
      { label: w.adult ? tr('取消 18+') : tr('标记为 18+'), icon: CircleAlert, onSelect: () => void updateWorkspace(db, w.id, { adult: !w.adult }) },
      ...(label === 'icon' ? [
        { divider: true },
        ...([['emoji', 'Emoji', Smile], ['lucide', tr('线性图标'), Shapes], ['char', tr('字符'), CaseSensitive]] as const).map(([v, l, icon]) => ({
          label: l, icon, checked: settings.workspaceIconStyle === v, onSelect: () => void updateSettings({ workspaceIconStyle: v }),
        })),
      ] : []),
      { divider: true },
      {
        label: tr('删除'), icon: Trash2, danger: true, disabled: w.source === 'inbox',
        onSelect: async () => {
          if (await dialogs.confirm({ title: tr('删除工作区「{0}」？', w.name), description: tr('其中的全部抽屉与书签都会删除（有分身的书签由分身接任）。'), okText: tr('删除'), danger: true })) {
            await deleteWorkspace(db, w.id);
          }
        },
      },
    ]);

  // 「待整理」位置固定，其余工作区按拖拽预览顺序填回各自的槽位
  let slot = 0;
  const ordered = workspaces.map((w) => (w.source === 'inbox' ? { w, ghost: false } : (({ t, ghost }) => ({ w: t, ghost }))(sort.rows[slot++]!)));
  const home = <HomeItem key="home" active={view === 'home'} horizontal={top} alignStart={!top && label !== 'icon'} onClick={() => setView('home')} />;
  // 名字放不下时（compact）：没选中的工作区只显示图标、不倾斜，不再叠压出半截名字
  const [compact, setCompact] = useState(false);
  const wsItems = ordered.map(({ w, ghost }, i) => {
    const active = view === 'workspace' && w.id === current;
    return (
    <NavItem key={w.id} w={w} active={active} label={top && compact && !active ? 'icon' : label} horizontal={top} right={right} bottom={bottom}
      tilt={top ? (compact ? 0 : tilt(w.id, i)) : undefined}
      ghost={ghost} dnd={w.source === 'inbox' ? undefined : sort.bind(w.id)}
      onClick={() => selectWorkspace(w.id)} onContextMenu={(e) => ctx(e, w)} />
    );
  });

  if (top) {
    return (
      <nav ref={navRef} {...sort.container} className="relative flex items-center gap-2 pl-11 pr-20 py-1">
        <div className="shrink-0">{home}</div>
        <OverlapStrip label={label} compact={compact} onCompact={setCompact} activeKey={view === 'workspace' ? current : view}>{wsItems}</OverlapStrip>
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <AppMenu onSearch={onSearch} onSettings={onSettings} onNewWorkspace={() => void add()} side={bottom ? 'top' : 'bottom'} align="end" />
        </div>
      </nav>
    );
  }

  return (
    <nav ref={navRef} {...sort.container} className={`relative flex shrink-0 flex-col px-2 ${label === 'icon' ? 'pt-12 pb-20 w-16 items-center' : 'py-12'} ${label === 'icon' ? 'w-16 items-center' : 'w-max min-w-36 max-w-60'}`}>
      <div className="flex min-h-0 w-full flex-1 flex-col gap-0.5 overflow-y-auto [justify-content:safe_center] [scrollbar-width:none]">{home}{wsItems}</div>
      <div className={`absolute inset-x-0 bottom-2 flex items-center px-3 ${label === 'icon' ? 'justify-center' : ''}`}>
        <AppMenu onSearch={onSearch} onSettings={onSettings} onNewWorkspace={() => void add()} side={label === 'icon' ? (right ? 'left' : 'right') : 'top'} vertical={label === 'icon'} />
      </div>
    </nav>
  );
}

/** 导航图标尺寸；选中与否只用颜色深浅区分，不放大 */
const ICON = 22;
/** 只显示图标时，顶部卡片就是一个图标块 */
const CARD_ICON = 34;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FADE = 32;

/** 重叠卡片条：至少重叠 MIN_OVERLAP，每张卡至少露出 REVEAL（只显示图标时露出 REVEAL_ICON） */
const GAP = 6;
const MIN_OVERLAP = 8;
const REVEAL = 40;
const REVEAL_ICON = 20;

/** 按 id 算出固定的倾斜幅度（0.6°–2.5°），方向一左一右交替，像随手放下的卡片 */
function tilt(id: string, index: number) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const mag = 0.6 + ((h >>> 0) % 20) / 10.5;
  return (index % 2 ? 1 : -1) * Math.round(mag * 10) / 10;
}

/**
 * 顶部/底部工作区条：放得下就留间距平铺；放不下时卡片互相叠压，
 * 重叠量在 [MIN_OVERLAP, 卡宽 − REVEAL] 之间，按各卡宽度分配。叠到上限仍放不下才允许横向滚动。
 */
function OverlapStrip({ children, label, compact, onCompact, activeKey }: {
  children: ReactNode; label: 'both' | 'icon' | 'name'; compact: boolean; onCompact: (v: boolean) => void; activeKey?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const count = Children.count(children);
  const [scroll, setScroll] = useState(false);
  // 带名字平铺时需要的总宽度：收成图标后靠它判断窗口变宽时能不能放回名字
  const full = useRef(0);
  const reveal = label === 'icon' || compact ? REVEAL_ICON : REVEAL;
  // 工作区数量或显示方式变了：先按带名字的样子重新量一次
  useLayoutEffect(() => { full.current = 0; onCompact(false); }, [count, label, onCompact]);
  const layout = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const kids = [...el.children] as HTMLElement[];
    const n = kids.length;
    const widths = kids.map((k) => k.offsetWidth);
    const avail = el.clientWidth;
    const sum = widths.reduce((a, b) => a + b, 0);
    const fits = n < 2 || sum + GAP * (n - 1) <= avail;
    if (label !== 'icon') {
      if (!compact && !fits) { full.current = sum + GAP * (n - 1); onCompact(true); return; }
      if (compact && full.current && full.current <= avail) { onCompact(false); return; }
    }
    const caps = widths.map((_, i) => (i === 0 ? 0 : Math.max(0, widths[i - 1]! - reveal)));
    let margins: number[];
    if (fits) margins = kids.map((_, i) => (i === 0 ? 0 : GAP));
    else {
      const need = sum - avail;
      const at = (o: number) => caps.reduce((a, c, i) => a + (i === 0 ? 0 : Math.min(o, c)), 0);
      // 重叠量 o 越大总重叠越多：二分出刚好放下的 o，再夹在上下限之间
      let lo = 0, hi = Math.max(...caps, 0);
      for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; if (at(mid) < need) lo = mid; else hi = mid; }
      const o = Math.max(MIN_OVERLAP, hi);
      margins = caps.map((c, i) => (i === 0 ? 0 : -Math.min(o, Math.max(c, MIN_OVERLAP))));
    }
    kids.forEach((k, i) => { k.style.marginLeft = `${margins[i]}px`; });
    const total = sum + margins.reduce((a, b) => a + b, 0);
    setScroll(total > avail + 1);
  }, [reveal, label, compact, onCompact]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(el);
    for (const c of el.children) ro.observe(c);
    // 叠到上限仍放不下时的兜底：纵向滚轮转横向
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => { ro.disconnect(); el.removeEventListener('wheel', onWheel); };
  }, [layout, count]);

  // 兜底滚动时，当前工作区滚入视野
  useEffect(() => {
    const el = ref.current;
    const item = el?.querySelector<HTMLElement>('[data-active="true"]');
    if (!scroll || !el || !item) return;
    const l = item.offsetLeft - FADE, r = item.offsetLeft + item.offsetWidth + FADE - el.clientWidth;
    const to = l < el.scrollLeft ? l : r > el.scrollLeft ? r : null;
    if (to !== null) el.scrollTo({ left: Math.max(0, to), behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [scroll, activeKey]);
  const mask = scroll ? `linear-gradient(to right, #000 calc(100% - ${FADE}px), transparent)` : undefined;

  return (
    <div
      ref={ref}
      className={`relative flex h-12 min-w-0 flex-1 items-center [justify-content:safe_center] ${scroll ? 'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : ''}`}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {children}
    </div>
  );
}

function NavItem({
  w, active, label, horizontal, right = false, bottom = false, ghost = false, tilt: angle, dnd, onClick, onContextMenu,
}: {
  w: Workspace; active: boolean; label: 'both' | 'icon' | 'name'; horizontal: boolean; right?: boolean; bottom?: boolean; ghost?: boolean; tilt?: number;
  dnd?: { onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void; onDragStart: () => void };
  onClick: () => void; onContextMenu: (e: React.MouseEvent) => void;
}) {
  const [over, setOver] = useState(false);
  // 顶部/底部的卡片用工作区颜色铺满；只显示图标时卡片就是图标本身
  const tone = useTone(w.color) ?? '#8d8d86';
  const card = horizontal && angle !== undefined;
  // 名称被截断时才在提示里显示全名
  const nameEl = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(false);
  useEffect(() => {
    const el = nameEl.current;
    if (!el) { setCut(false); return; }
    const check = () => setCut(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w.name, label, horizontal]);
  const btn = (
    <button
      draggable={w.source !== 'inbox'}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_WORKSPACE, w.id);
        e.dataTransfer.effectAllowed = 'move';
        dnd?.onDragStart();
      }}
      onDragOver={(e) => {
        if (hasType(e, DND_PLACEMENT)) {
          e.preventDefault();
          setOver(true);
        } else dnd?.onDragOver(e);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const pid = e.dataTransfer.getData(DND_PLACEMENT);
        if (pid) void movePlacement(db, pid, w.id, null);
        else dnd?.onDrop(e);
      }}
      data-flip={w.id}
      data-flip-ws=""
      style={card ? ({ '--nv-tilt': `${angle}deg`, '--nv-tone': tone } as React.CSSProperties) : undefined}
      className={`group flex shrink-0 items-center text-left text-sm ${card
        ? `nv-ws-card rounded-lg ${label === 'icon' ? 'p-0' : label === 'both' ? 'gap-1.5 py-0.5 pl-0.5 pr-2' : 'px-2.5 py-1'} ${active ? 'font-semibold' : ''}`
        : `gap-2 px-2 py-1.5 ${horizontal ? 'rounded-md' : 'w-full rounded-md'} ${active ? 'font-medium text-kumo-strong' : 'text-kumo-subtle hover:text-kumo-default'}`
      } transition-colors ${over ? 'ring-2 ring-kumo-brand' : ''} ${ghost ? 'nv-ghost' : ''}`}
      aria-label={w.name}
      data-active={active || undefined}
    >
      {label !== 'name' && (
        <span className={`${card ? 'nv-ws-ico ' : ''}flex shrink-0 transition-opacity duration-150 ${card || active ? 'opacity-100' : 'opacity-45 group-hover:opacity-80'}`}>
          <WorkspaceIcon ws={w} plain={card} size={card ? (label === 'icon' ? CARD_ICON : ICON) : ICON} />
        </span>
      )}
      {label !== 'icon' && <span ref={nameEl} className={`truncate ${horizontal ? 'max-w-40' : 'flex-1'}`}>{w.name}</span>}
      {label !== 'icon' && w.adult && <span className="text-xs text-kumo-danger">18+</span>}
    </button>
  );
  const tip = [label === 'icon' || cut ? w.name : '', w.description].filter(Boolean).join(' · ');
  return tip ? <Tooltip content={tip} side={horizontal ? (bottom ? 'top' : 'bottom') : right ? 'left' : 'right'}>{btn}</Tooltip> : btn;
}

/** 导航最前面的「主页」入口：永远只显示图标，不跟工作区的显示方式走 */
function HomeItem({ active, horizontal, alignStart, onClick }: { active: boolean; horizontal: boolean; alignStart: boolean; onClick: () => void }) {
  const btn = (
    <button type="button" onClick={onClick} aria-label={tr('主页')} data-active={active || undefined}
      className={`flex shrink-0 items-center justify-center rounded-md p-1.5 transition-colors ${alignStart ? 'self-start' : ''} ${
        active ? 'text-kumo-strong' : 'text-kumo-subtle hover:text-kumo-default'}`}>
      <span className="flex shrink-0 items-center justify-center" style={{ width: ICON, height: ICON }}><House size={18} strokeWidth={active ? 2.5 : 2} /></span>
    </button>
  );
  return <Tooltip content={tr('主页')} side={horizontal ? 'bottom' : 'right'}>{btn}</Tooltip>;
}
