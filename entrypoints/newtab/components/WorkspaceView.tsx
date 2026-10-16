import { Masonry, MasonryItem } from './Masonry';
import { Button, Empty, Loader, Tooltip } from '@cloudflare/kumo';
import { FolderPlus, Plus, Tray } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PALETTE, db } from '@/src/db';
import { createBookmark, createDrawer, movePlacement, reorderDrawers, setWorkspaceView } from '@/src/lib/store';
import { loadWorkspace, type Item } from '@/src/lib/view';
import { useDialogs } from '@/src/ui/dialogs';
import { WorkspaceIcon } from '@/src/ui/icons';
import { useApp } from '@/src/ui/state';
import { DrawerCard } from './DrawerCard';
import { Items } from './Items';
import { ArrangeMenu, ViewMenu } from './menus';
import { Bento } from './Bento';
import { effectiveView } from '@/src/lib/view';

export function WorkspaceView({ workspaceId }: { workspaceId: string }) {
  const { visibility, settings, selectWorkspace, updateSettings } = useApp();
  const dialogs = useDialogs();
  const data = useLiveQuery(() => loadWorkspace(db, workspaceId, visibility), [workspaceId, visibility]);

  if (data === undefined) return <div className="flex justify-center p-12"><Loader /></div>;
  if (data === null) return null;
  const { workspace, top, drawers } = data;

  const newDrawer = async () => {
    const base = workspace.color ?? PALETTE[0]!;
    const res = await dialogs.create('抽屉', base);
    if (!res) return;
    const vis = await dialogs.askVisibility(settings.currentModeId, '抽屉');
    if (!vis) return;
    await createDrawer(db, workspace.id, res.name, vis === 'current' ? settings.currentModeId : undefined, res.color !== base ? res.color : undefined, res.description);
  };
  const newBookmark = async () => {
    const nb = await dialogs.newBookmark();
    if (nb?.url.trim()) await createBookmark(db, { ...nb, title: nb.title.trim() || undefined }, workspace.id, null);
  };
  const reveal = (item: Item) => {
    const src = item.mountedFrom?.drawer;
    if (!src) return;
    selectWorkspace(src.workspaceId);
    setTimeout(() => document.getElementById(`drawer-${src.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
  };
  const dropDrawer = (dragId: string, targetId: string, after: boolean) => {
    const ids = drawers.map((d) => d.drawer.id).filter((id) => id !== dragId);
    const at = ids.indexOf(targetId) + (after ? 1 : 0);
    ids.splice(at, 0, dragId);
    void reorderDrawers(db, ids);
  };

  const arrange = settings.arrange[workspace.id] ?? 'masonry';
  const card = (d: (typeof drawers)[number]) => (
    <DrawerCard data={d} workspace={workspace} arrange={arrange} onReveal={reveal} onDropDrawer={(id, after) => dropDrawer(id, d.drawer.id, after)} />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <WorkspaceIcon ws={workspace} size={20} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-medium">{workspace.name}</h1>
          {workspace.description && <p className="truncate text-sm text-kumo-subtle">{workspace.description}</p>}
        </div>
        <ArrangeMenu value={arrange} onChange={(v) => void updateSettings({ arrange: { ...settings.arrange, [workspace.id]: v } })} />
        <ViewMenu value={workspace.viewMode} onChange={(v) => v && void setWorkspaceView(db, workspace.id, v)} />
        <Tooltip content="新建书签" side="bottom"><Button variant="ghost" size="xs" shape="square" icon={<Plus />} aria-label="新建书签" onClick={() => void newBookmark()} /></Tooltip>
        <Tooltip content="新建抽屉" side="bottom"><Button variant="ghost" size="xs" shape="square" icon={<FolderPlus />} aria-label="新建抽屉" onClick={() => void newDrawer()} /></Tooltip>
      </div>

      {top.length === 0 && drawers.length === 0 ? (
        <Empty
          icon={<Tray size={40} />}
          title={workspace.source === 'inbox' ? '都整理好了' : '这个工作区还是空的'}
          description={workspace.source === 'inbox' ? '没有待整理的书签。' : '添加书签、新建抽屉，或从其他工作区「整理」过来。'}
        />
      ) : (
        <>
          {(top.length > 0) && (
            <Items
              items={top}
              view={workspace.viewMode}
              onDrop={(id, index) => void movePlacement(db, id, workspace.id, null, index)}
            />
          )}
          {arrange === 'masonry' ? (
            <Masonry>
              {drawers.map((d) => (
                <MasonryItem key={d.drawer.id} id={`drawer-${d.drawer.id}`}>{card(d)}</MasonryItem>
              ))}
            </Masonry>
          ) : arrange === 'bento' ? (
            <Bento
              head={settings.drawerHead === 'peek' ? 6 : 32}
              items={drawers.map((d) => ({ key: d.drawer.id, id: `drawer-${d.drawer.id}`, count: d.items.length + d.mounted.length, view: effectiveView(d.drawer, workspace), node: card(d) }))}
            />
          ) : (
            <div className={arrange === 'board' ? 'nv-masonry -mx-6 flex items-start gap-4 overflow-x-auto px-6 pb-3 [scrollbar-width:thin]' : 'nv-masonry flex flex-col gap-4'}>
              {drawers.map((d) => (
                <div key={d.drawer.id} id={`drawer-${d.drawer.id}`} className={arrange === 'board' ? 'w-[300px] shrink-0' : ''}>{card(d)}</div>
              ))}
            </div>
          )}
          {top.length === 0 && (
            <div
              className="rounded-lg border border-dashed border-kumo-line p-3 text-center text-xs text-kumo-subtle"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData('application/x-navill-placement');
                if (id) void movePlacement(db, id, workspace.id, null);
              }}
            >
              拖到这里放到工作区顶层
            </div>
          )}
        </>
      )}
    </div>
  );
}
