import { Button, DropdownMenu, Input } from '@cloudflare/kumo';
import {
  ArrowSquareOut, ArrowsOutCardinal, Copy, DotsThree, Plus, Shuffle, Trash, WarningCircle, Package, LinkBreak, Archive } from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { db, type Workspace } from '@/src/db';
import {
  AliasCycleError, createBookmark, deleteDrawer, dissolveDrawer, mountDrawer, moveDrawer, movePlacement, renameDrawer,
  shuffleDrawer, unmount, updateDrawer, archiveDrawer } from '@/src/lib/store';
import { effectiveView, type DrawerData, type Item } from '@/src/lib/view';
import { useDialogs } from '@/src/ui/dialogs';
import { OPEN_ALL_MAX, openAll } from '@/src/ui/open';
import { useApp } from '@/src/ui/state';
import { DND_DRAWER, hasType, insertAfter } from './dnd';
import { Items } from './Items';
import { SortMenu, ViewMenu } from './menus';

export function DrawerCard({
  data, workspace, onDropDrawer, onReveal,
}: { data: DrawerData; workspace: Workspace; onDropDrawer: (drawerId: string, after: boolean) => void; onReveal: (i: Item) => void }) {
  const { drawer, items, mounted } = data;
  const { settings } = useApp();
  const dialogs = useDialogs();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(drawer.name);
  const [dropSide, setDropSide] = useState<'before' | 'after' | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<number>();
  const height = live ?? drawer.height;
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
    if (nb?.url.trim()) await createBookmark(db, { url: nb.url, title: nb.title.trim() || undefined }, workspace.id, drawer.id);
  };

  const mount = async () => {
    const t = await dialogs.pickTarget({ title: `把「${drawer.name}」挂载到…`, drawersOnly: true, excludeDrawerIds: [drawer.id] });
    if (!t?.drawerId) return;
    try {
      await mountDrawer(db, drawer.id, t.drawerId);
    } catch (e) {
      if (e instanceof AliasCycleError) await dialogs.confirm({ title: '不能这样挂载', description: '目标抽屉已经直接或间接挂载了这个抽屉，会形成循环。', okText: '知道了' });
      else throw e;
    }
  };

  const groups = [...new Map(mounted.map((m) => [m.mountedFrom!.group.id, m.mountedFrom!])).values()];

  return (
    <section
      className={`nv-drawer flex flex-col gap-2 rounded-xl border border-kumo-line bg-kumo-elevated/75 p-3 backdrop-blur-sm ${dropSide === 'before' ? 'ring-2 ring-kumo-brand ring-offset-2' : ''} ${dropSide === 'after' ? 'ring-2 ring-kumo-brand' : ''}`}
      onDragOver={(e) => {
        if (!hasType(e, DND_DRAWER)) return;
        e.preventDefault();
        setDropSide(insertAfter(e, true) ? 'after' : 'before');
      }}
      onDragLeave={() => setDropSide(null)}
      onDrop={(e) => {
        const id = e.dataTransfer.getData(DND_DRAWER);
        const side = dropSide;
        setDropSide(null);
        if (!id || id === drawer.id) return;
        e.preventDefault();
        onDropDrawer(id, side === 'after');
      }}
    >
      <header
        className="nv-drawer-head flex items-center gap-0.5 text-kumo-subtle"
        draggable={!editing}
        onDragStart={(e) => {
          e.dataTransfer.setData(DND_DRAWER, drawer.id);
          e.dataTransfer.effectAllowed = 'move';
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
            aria-label="抽屉名称"
          />
        ) : (
          <h2 className="min-w-0 flex-1 cursor-grab truncate text-sm font-normal" title={`${drawer.name}，双击改名`} onDoubleClick={() => setEditing(true)}>
            {drawer.adult && <span className="mr-1 rounded bg-kumo-danger-tint px-1 text-xs text-kumo-danger">18+</span>}
            {display}
            <span className="ml-1.5 opacity-70">{all.length}</span>
          </h2>
        )}
        <ViewMenu value={view} inherited={!drawer.viewMode} onChange={(v) => void updateDrawer(db, drawer.id, { viewMode: v })} />
        <SortMenu value={drawer.sortMode ?? 'smart'} onChange={(v) => void updateDrawer(db, drawer.id, { sortMode: v })} />
        <DropdownMenu>
          <DropdownMenu.Trigger render={<Button variant="ghost" size="xs" shape="square" icon={<DotsThree weight="bold" />} aria-label="更多" />} />
          <DropdownMenu.Content>
            {all.length > 0 && all.length <= OPEN_ALL_MAX && (
              <DropdownMenu.Item icon={ArrowSquareOut} onClick={() => void openAll(all)}>全部打开</DropdownMenu.Item>
            )}
            <DropdownMenu.Item icon={Plus} onClick={() => void addBookmark()}>新建书签</DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item icon={Copy} onClick={() => void mount()}>创建分身</DropdownMenu.Item>
            {groups.map((g) => (
              <DropdownMenu.Item key={g.group.id} icon={LinkBreak} onClick={() => void unmount(db, g.group.id)}>解除挂载「{g.drawer.name}」</DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator />
            <DropdownMenu.Item icon={ArrowsOutCardinal} onClick={async () => {
              const t = await dialogs.pickTarget({ title: '移动抽屉到工作区…', workspacesOnly: true });
              if (t) await moveDrawer(db, drawer.id, t.workspaceId);
            }}>移动到工作区…</DropdownMenu.Item>
            <DropdownMenu.Item icon={WarningCircle} onClick={() => void updateDrawer(db, drawer.id, { adult: !drawer.adult })}>{drawer.adult ? '取消 18+' : '标记为 18+'}</DropdownMenu.Item>
            <DropdownMenu.Item icon={Shuffle} onClick={() => void shuffleDrawer(db, workspace.id, drawer.id)}>打乱</DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item icon={Archive} onClick={() => void archiveDrawer(db, drawer.id)}>归档</DropdownMenu.Item>
            <DropdownMenu.Item icon={Package} onClick={async () => {
              if (await dialogs.confirm({ title: `解散「${drawer.name}」？`, description: '抽屉会删除，其中的书签移到工作区顶层。', okText: '解散' })) await dissolveDrawer(db, drawer.id);
            }}>解散</DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item icon={Trash} variant="danger" onClick={async () => {
              if (await dialogs.confirm({ title: `删除「${drawer.name}」？`, description: `抽屉连同其中 ${items.length} 个书签一起删除。原书签有分身时，由分身接任。`, okText: '删除', danger: true })) await deleteDrawer(db, drawer.id);
            }}>删除</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </header>
      <div ref={bodyRef} className={height !== undefined ? 'nv-drawer-body -mx-1 overflow-y-auto px-1 [scrollbar-width:thin]' : 'nv-drawer-body'} style={height !== undefined ? { height } : undefined}>
        <Items
          items={all}
          view={view}
          emptyHint="拖书签到这里"
          onReveal={onReveal}
          onDrop={(placementId, index) => {
            void (async () => {
              if (drawer.sortMode !== 'manual') await updateDrawer(db, drawer.id, { sortMode: 'manual' });
              await movePlacement(db, placementId, workspace.id, drawer.id, Math.min(index, items.length));
            })();
          }}
        />
      </div>
      <ResizeHandle bodyRef={bodyRef} onLive={setLive} onCommit={(h) => { setLive(undefined); void updateDrawer(db, drawer.id, { height: h }); }} />
    </section>
  );
}

/**
 * 抽屉底部的拖拽手柄（resize handle）：上下拖动调整内容区高度，拖到最矮只剩标题行；
 * 拖到不小于内容自然高度时恢复自适应；双击恢复自适应。
 */
function ResizeHandle({ bodyRef, onLive, onCommit }: { bodyRef: React.RefObject<HTMLDivElement | null>; onLive: (h: number) => void; onCommit: (h: number | null) => void }) {
  const drag = useRef<{ y: number; h: number; max: number; last: number } | null>(null);
  return (
    <div
      role="separator" aria-orientation="horizontal" aria-label="拖动调整抽屉高度，双击恢复"
      className="group/handle -mb-3 -mt-1 flex h-3 w-1/2 cursor-ns-resize touch-none items-center self-center"
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
      <span className="h-1 w-full rounded-full bg-current opacity-15 transition-opacity group-hover/handle:opacity-40 group-active/handle:opacity-60" />
    </div>
  );
}
