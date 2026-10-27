import { revealDrawer } from '@/src/ui/reveal';
import { Masonry, MasonryItem } from './Masonry';
import { Button, Empty, Loader, Tooltip } from '@cloudflare/kumo';
import { FolderPlus, Inbox, Plus } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PALETTE, db } from '@/src/db';
import { createBookmark, createDrawer, movePlacement, placeInOrder, reorderDrawers, setWorkspaceView } from '@/src/lib/store';
import { loadWorkspace, type Item } from '@/src/lib/view';
import { useDialogs } from '@/src/ui/dialogs';
import { WorkspaceIcon } from '@/src/ui/icons';
import { useApp } from '@/src/ui/state';
import { DrawerCard } from './DrawerCard';
import { DND_PLACEMENT } from './dnd';
import { Items } from './Items';
import { ArrangeMenu, ViewMenu } from './menus';
import { Bento } from './Bento';
import { effectiveView } from '@/src/lib/view';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useShared } from '@/src/ui/useShared';
import { randomPresetColor } from '@/src/ui/colors';
import { NewDrawerPopover } from '@/src/ui/NewDrawerPopover';
import { useFlip, useSortable } from './sortable';

import { tr } from '@/src/i18n';
export function WorkspaceView({ workspaceId }: { workspaceId: string }) {
  const { visibility, settings, selectWorkspace, updateSettings } = useApp();
  const dialogs = useDialogs();
  // 结构共享：只有真正变了的抽屉 / 书签换新引用，其余的 memo 组件跳过重渲染
  const data = useShared(useLiveQuery(() => loadWorkspace(db, workspaceId, visibility), [workspaceId, visibility]));
  const area = useRef<HTMLDivElement>(null);
  const arrange = settings.arrange[workspaceId] ?? 'masonry';
  const sort = useSortable({
    list: `drawers:${workspaceId}`, kind: 'drawer', items: data?.drawers ?? [], keyOf: (d) => d.drawer.id,
    horizontal: arrange !== 'strip',
    onDrop: (_, keys) => void reorderDrawers(db, keys),
  });
  useFlip(area, sort.sig, '[data-flip-drawer]');
  const newBtn = useRef<HTMLButtonElement>(null);
  const [newOpen, setNewOpen] = useState(false);
  const dragging = useDraggingPlacement();
  const [over, setOver] = useState(false);
  const reveal = useCallback((item: Item) => {
    const src = item.mountedFrom?.drawer;
    if (!src) return;
    selectWorkspace(src.workspaceId);
    revealDrawer(src.id);
  }, [selectWorkspace]);

  if (data === undefined) return <div className="flex justify-center p-12"><Loader /></div>;
  if (data === null) return null;
  const { workspace, top, drawers } = data;

  const base = workspace.color ?? PALETTE[0]!;
  const newDrawer = () => setNewOpen(true);
  const createNew = async (name: string, color: string) => {
    const vis = await dialogs.askVisibility(settings.currentModeId, tr('抽屉'));
    if (!vis) return;
    const c = settings.randomDrawerColor ? randomPresetColor() : color !== base ? color : undefined;
    await createDrawer(db, workspace.id, name, vis === 'current' ? settings.currentModeId : undefined, c);
  };
  const newBookmark = async () => {
    const nb = await dialogs.newBookmark();
    if (nb?.url.trim()) await createBookmark(db, { ...nb, title: nb.title.trim() || undefined }, workspace.id, null);
  };
  const card = (d: (typeof drawers)[number], ghost: boolean) => (
    <DrawerCard data={d} workspace={workspace} arrange={arrange} onReveal={reveal} ghost={ghost} dnd={sort.bind(d.drawer.id)} />
  );
  const rows = sort.rows;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <WorkspaceIcon ws={workspace} size={20} />
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h1 className="line-clamp-2 min-w-0 shrink-0 break-words text-base font-medium" style={{ maxWidth: '60%' }}>{workspace.name}</h1>
          {workspace.description && <p className="min-w-0 truncate text-sm text-kumo-subtle" title={workspace.description}>{workspace.description}</p>}
        </div>
        {dragging && top.length === 0 && (
          <div
            className={`flex h-8 min-w-0 flex-[2] items-center justify-center truncate rounded-lg border border-dashed px-3 text-xs transition-colors ${over ? 'border-kumo-brand bg-kumo-tint text-kumo-default' : 'border-kumo-line text-kumo-subtle'}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setOver(false);
              const id = e.dataTransfer.getData(DND_PLACEMENT);
              if (id) void movePlacement(db, id, workspace.id, null);
            }}
          >
            {tr('拖到这里放到工作区顶层')}
          </div>
        )}
        <div className="nv-ws-tools flex items-center gap-0.5">
        <ArrangeMenu value={arrange} onChange={(v) => void updateSettings({ arrange: { ...settings.arrange, [workspace.id]: v } })} />
        <ViewMenu value={workspace.viewMode} onChange={(v) => v && void setWorkspaceView(db, workspace.id, v)} />
        <Tooltip content={tr('新建书签')} side="bottom"><Button variant="ghost" size="xs" shape="square" icon={<Plus size="1em" />} aria-label={tr('新建书签')} onClick={() => void newBookmark()} /></Tooltip>
        <Tooltip content={tr('新建抽屉')} side="bottom"><Button variant="ghost" size="xs" shape="square" ref={newBtn} icon={<FolderPlus size="1em" />} aria-label={tr('新建抽屉')} onClick={newDrawer} /></Tooltip>
        </div>
        <NewDrawerPopover anchor={newBtn} open={newOpen} onOpenChange={setNewOpen} color={base} random={settings.randomDrawerColor} onCreate={(n, c) => void createNew(n, c)} />
      </div>

      {top.length === 0 && drawers.length === 0 ? (
        <Empty
          icon={<Inbox size={40} />}
          title={workspace.source === 'inbox' ? tr('都整理好了') : tr('这个工作区还是空的')}
          description={workspace.source === 'inbox' ? tr('没有待整理的书签。') : tr('添加书签、新建抽屉，或从其他工作区「整理」过来。')}
        />
      ) : (
        <>
          {(top.length > 0) && (
            <Items
              items={top}
              view={workspace.viewMode}
              list={`top:${workspace.id}`}
              onDrop={(id, ids) => void placeInOrder(db, id, ids, workspace.id, null)}
            />
          )}
          <div ref={area} {...sort.container}>
          {arrange === 'masonry' ? (
            <Masonry frozen={dragging}>
              {rows.map(({ t: d, ghost }) => (
                <MasonryItem key={d.drawer.id} id={`drawer-${d.drawer.id}`}>{card(d, ghost)}</MasonryItem>
              ))}
            </Masonry>
          ) : arrange === 'bento' ? (
            <Bento
              head={settings.drawerHead === 'peek' ? 6 : 32}
              items={rows.map(({ t: d, ghost }) => ({ key: d.drawer.id, id: `drawer-${d.drawer.id}`, count: d.items.length + d.mounted.length, view: effectiveView(d.drawer, workspace), node: card(d, ghost) }))}
            />
          ) : (
            <div className={arrange === 'board' ? 'nv-masonry -mx-6 flex items-start gap-4 overflow-x-auto px-6 pb-3 [scrollbar-width:thin]' : 'nv-masonry flex flex-col gap-4'}>
              {rows.map(({ t: d, ghost }) => (
                <div key={d.drawer.id} id={`drawer-${d.drawer.id}`} className={arrange === 'board' ? 'w-[300px] shrink-0' : ''}>{card(d, ghost)}</div>
              ))}
            </div>
          )}
          </div>
        </>
      )}
    </div>
  );
}

/** 正在拖动书签（placement）时为 true：用于拖拽开始后才显示「放到工作区顶层」的落点 */
function useDraggingPlacement() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const start = (e: DragEvent) => { if (e.dataTransfer?.types.includes(DND_PLACEMENT)) setTimeout(() => setOn(true), 0); }; // 延后渲染，避免拖拽开始时改 DOM 打断拖动
    const end = () => setOn(false);
    document.addEventListener('dragstart', start);
    document.addEventListener('dragend', end);
    document.addEventListener('drop', end);
    return () => { document.removeEventListener('dragstart', start); document.removeEventListener('dragend', end); document.removeEventListener('drop', end); };
  }, []);
  return on;
}
