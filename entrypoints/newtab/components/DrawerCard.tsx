import { Button, DropdownMenu, Input } from '@cloudflare/kumo';
import {
  ArrowSquareOut, ArrowsOutCardinal, CaretDown, CaretRight, Copy, DotsThree, Plus, Shuffle, Trash, WarningCircle, Package, LinkBreak, Archive } from '@phosphor-icons/react';
import { useState } from 'react';
import { db, type Workspace } from '@/src/db';
import {
  AliasCycleError, createBookmark, deleteDrawer, dissolveDrawer, mountDrawer, moveDrawer, movePlacement, renameDrawer,
  shuffleDrawer, unmount, updateDrawer, archiveDrawer } from '@/src/lib/store';
import { effectiveView, type DrawerData, type Item } from '@/src/lib/view';
import { useDialogs } from '@/src/ui/dialogs';
import { openAll } from '@/src/ui/open';
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
      className={`flex flex-col gap-2 rounded-xl border border-kumo-line bg-kumo-elevated p-3 ${dropSide === 'before' ? 'ring-2 ring-kumo-brand ring-offset-2' : ''} ${dropSide === 'after' ? 'ring-2 ring-kumo-brand' : ''}`}
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
        className="flex items-center gap-1"
        draggable={!editing}
        onDragStart={(e) => {
          e.dataTransfer.setData(DND_DRAWER, drawer.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
      >
        <Button variant="ghost" size="xs" shape="square" icon={drawer.collapsed ? <CaretRight /> : <CaretDown />} aria-label={drawer.collapsed ? '展开' : '折叠'} onClick={() => void updateDrawer(db, drawer.id, { collapsed: !drawer.collapsed })} />
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
          <h2 className="min-w-0 flex-1 cursor-grab truncate text-sm font-semibold" title={`${drawer.name}（双击改名）`} onDoubleClick={() => setEditing(true)}>
            {drawer.adult && <span className="mr-1 rounded bg-kumo-danger-tint px-1 text-xs text-kumo-danger">18+</span>}
            {display}
            <span className="ml-1.5 text-xs font-normal text-kumo-subtle">{all.length}</span>
          </h2>
        )}
        <ViewMenu value={view} inherited={!drawer.viewMode} onChange={(v) => void updateDrawer(db, drawer.id, { viewMode: v })} />
        <SortMenu value={drawer.sortMode ?? 'manual'} onChange={(v) => void updateDrawer(db, drawer.id, { sortMode: v })} />
        <DropdownMenu>
          <DropdownMenu.Trigger render={<Button variant="ghost" size="xs" shape="square" icon={<DotsThree weight="bold" />} aria-label="更多" />} />
          <DropdownMenu.Content>
            <DropdownMenu.Item icon={ArrowSquareOut} disabled={all.length === 0} onClick={() => void openAll(all)}>全部打开（{all.length}）</DropdownMenu.Item>
            <DropdownMenu.Item icon={Plus} onClick={() => void addBookmark()}>新建书签</DropdownMenu.Item>
            <DropdownMenu.Item icon={Copy} onClick={() => void mount()}>创建分身（挂载到其他抽屉）</DropdownMenu.Item>
            {groups.map((g) => (
              <DropdownMenu.Item key={g.group.id} icon={LinkBreak} onClick={() => void unmount(db, g.group.id)}>解除挂载「{g.drawer.name}」</DropdownMenu.Item>
            ))}
            <DropdownMenu.Item icon={ArrowsOutCardinal} onClick={async () => {
              const t = await dialogs.pickTarget({ title: '移动抽屉到工作区…', workspacesOnly: true });
              if (t) await moveDrawer(db, drawer.id, t.workspaceId);
            }}>移动到工作区…</DropdownMenu.Item>
            <DropdownMenu.Item icon={WarningCircle} onClick={() => void updateDrawer(db, drawer.id, { adult: !drawer.adult })}>{drawer.adult ? '取消 18+' : '标记为 18+'}</DropdownMenu.Item>
            <DropdownMenu.Item icon={Shuffle} onClick={() => void shuffleDrawer(db, workspace.id, drawer.id)}>打乱</DropdownMenu.Item>
            <DropdownMenu.Item icon={Archive} onClick={() => void archiveDrawer(db, drawer.id)}>归档</DropdownMenu.Item>
            <DropdownMenu.Item icon={Package} onClick={async () => {
              if (await dialogs.confirm({ title: `解散「${drawer.name}」？`, description: '抽屉会删除，其中的书签移到工作区顶层。', okText: '解散' })) await dissolveDrawer(db, drawer.id);
            }}>解散</DropdownMenu.Item>
            <DropdownMenu.Item icon={Trash} variant="danger" onClick={async () => {
              if (await dialogs.confirm({ title: `删除「${drawer.name}」？`, description: `抽屉连同其中 ${items.length} 个书签一起删除。原书签有分身时，由分身接任。`, okText: '删除', danger: true })) await deleteDrawer(db, drawer.id);
            }}>删除</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </header>
      {!drawer.collapsed && (
        <Items
          items={all}
          view={view}
          emptyHint="拖书签到这里"
          onReveal={onReveal}
          onDrop={(placementId, index) => {
            void (async () => {
              if (drawer.sortMode && drawer.sortMode !== 'manual') await updateDrawer(db, drawer.id, { sortMode: 'manual' });
              await movePlacement(db, placementId, workspace.id, drawer.id, Math.min(index, items.length));
            })();
          }}
        />
      )}
    </section>
  );
}
