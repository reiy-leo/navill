import { Button, DropdownMenu, Input, LayerCard, Tooltip } from '@cloudflare/kumo';
import { Archive, CircleAlert, Copy, Ellipsis, ExternalLink, Move, Package, Palette, Plus, Share2, Shuffle, Trash2, Unlink } from 'lucide-react';
import { memo, useLayoutEffect, useRef, useState } from 'react';
import { useTone } from '@/src/ui/colors';
import { DrawerColorPopover } from '@/src/ui/ColorPicker';
import { db, type Workspace } from '@/src/db';
import {
  AliasCycleError, createBookmark, deleteDrawer, dissolveDrawer, mountDrawer, moveDrawer, placeInOrder, renameDrawer,
  shuffleDrawer, unmount, updateDrawer, archiveDrawer } from '@/src/lib/store';
import { effectiveView, type DrawerData, type Item } from '@/src/lib/view';
import { useDialogs } from '@/src/ui/dialogs';
import { OPEN_ALL_MAX, openAll } from '@/src/ui/open';
import { useApp } from '@/src/ui/state';
import type { Arrange } from '@/src/lib/settings';
import { DND_DRAWER } from './dnd';
import { Items } from './Items';
import { SortMenu, ViewMenu } from './menus';

import { tr } from '@/src/i18n';
/** memo：数据经结构共享、拖放处理函数为稳定引用，未变的抽屉不重渲染 */
export const DrawerCard = memo(function DrawerCard({
  data, workspace, arrange, ghost, dnd, onReveal,
}: {
  data: DrawerData; workspace: Workspace; arrange: Arrange; ghost?: boolean; onReveal: (i: Item) => void;
  /** 拖拽排序的处理函数（来自 useSortable） */
  dnd: { onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void; onDragStart: () => void };
}) {
  const { drawer, items, mounted } = data;
  const { settings } = useApp();
  const dialogs = useDialogs();
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState(drawer.name);
  const bodyRef = useRef<HTMLDivElement>(null);
  const moreBtn = useRef<HTMLButtonElement>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [live, setLive] = useState<number>();
  // 松手后保持拖拽高度，等数据库里的新高度回来再撤掉，避免先闪回原大小
  useLayoutEffect(() => setLive(undefined), [drawer.height]);
  // 横条和便当不用高度上限与手动高度：横条单行横向滚动，便当由网格格子决定高度
  const sized = arrange === 'masonry' || arrange === 'board';
  const cap = useRowCap(bodyRef, sized && live === undefined && drawer.height === undefined);
  const height = sized ? live ?? drawer.height : undefined;
  const fill = arrange === 'bento';
  const tint = useTone(drawer.color);
  const view = effectiveView(drawer, workspace);
  const all = [...items, ...mounted];
  const display = settings.drawerName === 'last' ? drawer.path[drawer.path.length - 1] ?? drawer.name : drawer.name;

  const commitName = async () => {
    setEditing(false);
    if (name.trim() && name.trim() !== drawer.name) await renameDrawer(db, drawer.id, name);
    else setName(drawer.name);
  };

  const addBookmark = async () => {
    const nb = await dialogs.newBookmark();
    if (nb?.url.trim()) await createBookmark(db, { ...nb, title: nb.title.trim() || undefined }, workspace.id, drawer.id);
  };

  const mount = async () => {
    const t = await dialogs.pickTarget({ title: tr('把「{0}」挂载到…', drawer.name), drawersOnly: true, excludeDrawerIds: [drawer.id] });
    if (!t?.drawerId) return;
    try {
      await mountDrawer(db, drawer.id, t.drawerId);
    } catch (e) {
      if (e instanceof AliasCycleError) await dialogs.confirm({ title: tr('不能这样挂载'), description: tr('目标抽屉已经直接或间接挂载了这个抽屉，会形成循环。'), okText: tr('知道了') });
      else throw e;
    }
  };

  const groups = [...new Map(mounted.map((m) => [m.mountedFrom!.group.id, m.mountedFrom!])).values()];

  const title = (
    <h2 className="min-w-0 flex-1 cursor-grab truncate text-sm font-normal" title={drawer.description ? undefined : tr('{0}，双击改名', drawer.name)} onDoubleClick={() => setEditing(true)}>
      {drawer.adult && <span className="mr-1 rounded bg-kumo-danger-tint px-1 text-xs text-kumo-danger">18+</span>}
      {display}
      <span className="ml-1.5 opacity-70">{all.length}</span>
    </h2>
  );
  return (
    <LayerCard
      render={<section />}
      data-head={settings.drawerHead}
      data-open={menuOpen || editing || undefined}
      data-flip={drawer.id}
      data-flip-drawer=""
      style={tint ? ({ '--ws-color': tint } as React.CSSProperties) : undefined}
      className={`nv-drawer ${fill ? 'h-full' : ''} rounded-xl bg-kumo-elevated/75 ring-kumo-line backdrop-blur-sm ${ghost ? 'nv-ghost' : ''}`}
      onDragOver={dnd.onDragOver}
      onDrop={dnd.onDrop}
    >
      <LayerCard.Secondary
        className="nv-drawer-head my-0 h-8 gap-0.5 bg-transparent py-0 pl-3 pr-1 text-sm font-normal"
        draggable={!editing}
        onDragStart={(e) => {
          e.dataTransfer.setData(DND_DRAWER, drawer.id);
          e.dataTransfer.effectAllowed = 'move';
          dnd.onDragStart();
        }}
      >
        {editing ? (
          <Input
            autoFocus
            size="xs"
            className="min-w-0 flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void commitName()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void commitName();
              if (e.key === 'Escape') {
                setName(drawer.name);
                setEditing(false);
              }
            }}
            aria-label={tr('抽屉名称')}
          />
        ) : (
          drawer.description ? <Tooltip content={drawer.description} side="top" asChild>{title}</Tooltip> : title
        )}
        <ViewMenu value={view} inherited={!drawer.viewMode} onChange={(v) => void updateDrawer(db, drawer.id, { viewMode: v })} />
        <SortMenu value={drawer.sortMode ?? 'smart'} onChange={(v) => void updateDrawer(db, drawer.id, { sortMode: v })} />
        <DrawerColorPopover anchor={moreBtn} open={colorOpen} onOpenChange={setColorOpen} value={drawer.color} follow={workspace.color} onChange={(color) => void updateDrawer(db, drawer.id, { color })} />
        <DropdownMenu onOpenChange={setMenuOpen}>
          <DropdownMenu.Trigger render={<Button ref={moreBtn} variant="ghost" size="xs" shape="square" icon={<Ellipsis size="1em" strokeWidth={2.5} />} aria-label={tr('更多')} />} />
          <DropdownMenu.Content>
            {all.length > 0 && all.length <= OPEN_ALL_MAX && (
              <DropdownMenu.Item icon={ExternalLink} onClick={() => void openAll(all)}>{tr('全部打开')}</DropdownMenu.Item>
            )}
            <DropdownMenu.Item icon={Plus} onClick={() => void addBookmark()}>{tr('新建书签')}</DropdownMenu.Item>
            <DropdownMenu.Item icon={Palette} onClick={() => setTimeout(() => setColorOpen(true), 0)}>{tr('指定颜色')}</DropdownMenu.Item>
            <DropdownMenu.Item icon={Share2} onClick={() => dialogs.share('drawer', drawer.id, drawer.name)}>{tr('分享…')}</DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item icon={Copy} onClick={() => void mount()}>{tr('创建分身')}</DropdownMenu.Item>
            {groups.map((g) => (
              <DropdownMenu.Item key={g.group.id} icon={Unlink} onClick={() => void unmount(db, g.group.id)}>{tr('解除挂载「')}{g.drawer.name}」</DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator />
            <DropdownMenu.Item icon={Move} onClick={async () => {
              const t = await dialogs.pickTarget({ title: tr('移动抽屉到工作区…'), workspacesOnly: true });
              if (t) await moveDrawer(db, drawer.id, t.workspaceId);
            }}>{tr('移动到…')}</DropdownMenu.Item>
            <DropdownMenu.Item icon={CircleAlert} onClick={() => void updateDrawer(db, drawer.id, { adult: !drawer.adult })}>{drawer.adult ? tr('取消 18+') : tr('标记为 18+')}</DropdownMenu.Item>
            <DropdownMenu.Item icon={Shuffle} onClick={() => void shuffleDrawer(db, workspace.id, drawer.id)}>{tr('打乱')}</DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item icon={Archive} onClick={() => void archiveDrawer(db, drawer.id)}>{tr('归档')}</DropdownMenu.Item>
            <DropdownMenu.Item icon={Package} onClick={async () => {
              if (await dialogs.confirm({ title: tr('解散「{0}」？', drawer.name), description: tr('抽屉会删除，其中的书签移到工作区顶层。'), okText: tr('解散') })) await dissolveDrawer(db, drawer.id);
            }}>{tr('解散')}</DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item icon={Trash2} variant="danger" onClick={async () => {
              if (await dialogs.confirm({ title: tr('删除「{0}」？', drawer.name), description: tr('抽屉连同其中 {0} 个书签一起删除。原书签有分身时，由分身接任。', items.length), okText: tr('删除'), danger: true })) await deleteDrawer(db, drawer.id);
            }}>{tr('删除')}</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </LayerCard.Secondary>
      <LayerCard.Primary className={`nv-drawer-primary gap-0 rounded-xl p-2 ring-kumo-line ${fill ? 'min-h-0 flex-1' : ''}`}>
      <div
        ref={bodyRef}
        className={fill ? 'nv-drawer-body -mx-1 min-h-0 flex-1 overflow-y-auto px-1 [scrollbar-width:thin]' : height !== undefined || cap !== undefined ? 'nv-drawer-body -mx-1 overflow-y-auto px-1 [scrollbar-width:thin]' : 'nv-drawer-body'}
        style={height !== undefined ? { height } : cap !== undefined ? { maxHeight: cap } : undefined}
      >
        <Items
          items={all}
          view={view}
          strip={arrange === 'strip'}
          list={`drawer:${drawer.id}`}
          emptyHint={tr('拖书签到这里')}
          onReveal={onReveal}
          onDrop={(placementId, ids) => {
            void (async () => {
              if (drawer.sortMode !== 'manual') await updateDrawer(db, drawer.id, { sortMode: 'manual' });
              await placeInOrder(db, placementId, ids, workspace.id, drawer.id);
            })();
          }}
        />
      </div>
      {sized && <ResizeHandle bodyRef={bodyRef} onLive={setLive} onCommit={(h) => { if ((h ?? null) === (drawer.height ?? null)) setLive(undefined); void updateDrawer(db, drawer.id, { height: h }); }} />}
      </LayerCard.Primary>
    </LayerCard>
  );
});

/** 自适应高度时最多显示的行数，多余的在抽屉内滚动 */
export const AUTO_MAX_ROWS = 10;

/** 自适应模式下按网格实际行位置量出第 11 行的顶部，作为最大高度；不足 10 行返回 undefined */
function useRowCap(bodyRef: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [cap, setCap] = useState<number>();
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!enabled || !body) { setCap(undefined); return; }
    const measure = () => {
      const grid = body.firstElementChild as HTMLElement | null;
      if (!grid) return setCap(undefined);
      const origin = body.getBoundingClientRect().top - body.scrollTop;
      const tops = [...new Set([...grid.children].map((c) => Math.round(c.getBoundingClientRect().top - origin)))].sort((x, y) => x - y);
      const next = tops[AUTO_MAX_ROWS];
      setCap(next === undefined ? undefined : next - 2);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    if (body.firstElementChild) ro.observe(body.firstElementChild);
    return () => ro.disconnect();
  }, [bodyRef, enabled]);
  return cap;
}

/**
 * 抽屉底部的拖拽手柄（resize handle）：上下拖动调整内容区高度，拖到最矮只剩标题行；
 * 拖到不小于内容自然高度时恢复自适应；双击恢复自适应。
 */
function ResizeHandle({ bodyRef, onLive, onCommit }: { bodyRef: React.RefObject<HTMLDivElement | null>; onLive: (h: number) => void; onCommit: (h: number | null) => void }) {
  const drag = useRef<{ y: number; h: number; max: number; last: number } | null>(null);
  return (
    <div
      role="separator" aria-orientation="horizontal" aria-label={tr('拖动调整抽屉高度，双击恢复')}
      className="group/handle -mb-2 -mt-1 flex h-3 w-1/2 cursor-ns-resize touch-none items-center self-center"
      onPointerDown={(e) => {
        const el = bodyRef.current;
        if (!el || e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const h = el.clientHeight;
        drag.current = { y: e.clientY, h, max: el.scrollHeight, last: h };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        d.last = Math.max(0, Math.min(d.max, Math.round(d.h + e.clientY - d.y)));
        onLive(d.last);
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        if (d.last === d.h) { onCommit(d.h >= d.max - 1 ? null : d.h); return; }
        onCommit(d.last >= d.max - 1 ? null : d.last);
      }}
      onPointerCancel={() => { drag.current = null; }}
      onDoubleClick={() => onCommit(null)}
    >
      <span className="nv-handle-bar h-1 w-full rounded-full bg-current" />
    </div>
  );
}
