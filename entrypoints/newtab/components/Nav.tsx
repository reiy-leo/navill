import { Button, Tooltip } from '@cloudflare/kumo';
import { Archive, CaretDoubleLeft, CaretDoubleRight, CaretLeft, CaretRight, PencilSimple, Plus, Trash, WarningCircle } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { db, type Workspace } from '@/src/db';
import { createWorkspace, deleteWorkspace, movePlacement, reorderWorkspaces, updateWorkspace } from '@/src/lib/store';
import { workspaceVisible } from '@/src/lib/view';
import { useContextMenu } from '@/src/ui/ContextMenu';
import { useDialogs } from '@/src/ui/dialogs';
import { WorkspaceIcon } from '@/src/ui/icons';
import { useApp } from '@/src/ui/state';
import { DND_PLACEMENT, DND_WORKSPACE, hasType, insertAfter } from './dnd';

export function useVisibleWorkspaces() {
  const { visibility } = useApp();
  return useLiveQuery(async () => (await db.workspaces.orderBy('order').toArray()).filter((w) => workspaceVisible(w, visibility)), [visibility]);
}

export function Nav({ current }: { current?: string }) {
  const { settings, updateSettings, selectWorkspace, view, setView } = useApp();
  const workspaces = useVisibleWorkspaces() ?? [];
  const dialogs = useDialogs();
  const menu = useContextMenu();
  const scroller = useRef<HTMLDivElement>(null);
  const top = settings.navLayout === 'top';
  const collapsed = !top && settings.sidebarCollapsed;
  const label = collapsed ? 'icon' : settings.navLabel;

  const add = async () => {
    const name = await dialogs.prompt('新建工作区', '', '工作区名称');
    if (name === null) return;
    const vis = await dialogs.askVisibility(settings.currentModeId, '工作区');
    if (!vis) return;
    const ws = await createWorkspace(db, { name }, vis === 'current' ? settings.currentModeId : undefined);
    selectWorkspace(ws.id);
  };

  const ctx = (e: React.MouseEvent, w: Workspace) =>
    menu(e, [
      { label: '编辑', icon: PencilSimple, onSelect: () => dialogs.editWorkspace(w.id) },
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
      <nav className="flex items-center gap-1 border-b border-kumo-line px-2 py-1.5">
        <Button variant="ghost" size="xs" shape="square" icon={<CaretLeft />} aria-label="向左滚动" onClick={() => scroller.current?.scrollBy({ left: -240, behavior: 'smooth' })} />
        <div
          ref={scroller}
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]"
          onWheel={(e) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) scroller.current?.scrollBy({ left: e.deltaY });
          }}
        >
          {items}
        </div>
        <Button variant="ghost" size="xs" shape="square" icon={<CaretRight />} aria-label="向右滚动" onClick={() => scroller.current?.scrollBy({ left: 240, behavior: 'smooth' })} />
        <Button variant="ghost" size="xs" shape="square" icon={<Plus />} aria-label="新建工作区" onClick={() => void add()} />
        <Button variant={view === 'archive' ? 'secondary' : 'ghost'} size="xs" shape="square" icon={<Archive />} aria-label="归档" title="归档" onClick={() => setView('archive')} />
      </nav>
    );
  }

  return (
    <nav className={`flex shrink-0 flex-col gap-1 border-r border-kumo-line p-2 transition-[width] ${collapsed ? 'w-14 items-center' : 'w-56'}`}>
      <div className={`flex items-center gap-1 px-1 pb-2 ${collapsed ? 'flex-col' : ''}`}>
        {!collapsed && <span className="flex-1 text-base font-semibold">Navill</span>}
        <Button variant="ghost" size="xs" shape="square" icon={collapsed ? <CaretDoubleRight /> : <CaretDoubleLeft />} aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'} onClick={() => void updateSettings({ sidebarCollapsed: !collapsed })} />
      </div>
      <div className="flex min-h-0 w-full flex-1 flex-col gap-0.5 overflow-y-auto">{items}</div>
      <div className={`flex w-full gap-1 border-t border-kumo-line pt-2 ${collapsed ? 'flex-col items-center' : ''}`}>
        {collapsed ? (
          <Button variant="ghost" size="sm" shape="square" icon={<Plus />} onClick={() => void add()} aria-label="新建工作区" />
        ) : (
          <Button variant="ghost" size="sm" className="flex-1 justify-start" icon={<Plus />} onClick={() => void add()}>新建工作区</Button>
        )}
        <Button variant={view === 'archive' ? 'secondary' : 'ghost'} size="sm" shape="square" icon={<Archive />} aria-label="归档" title="归档" onClick={() => setView('archive')} />
      </div>
    </nav>
  );
}

function NavItem({
  w, active, label, horizontal, onClick, onContextMenu, onReorder,
}: {
  w: Workspace; active: boolean; label: 'both' | 'icon' | 'name'; horizontal: boolean;
  onClick: () => void; onContextMenu: (e: React.MouseEvent) => void; onReorder: (dragId: string, targetId: string, after: boolean) => void;
}) {
  const [over, setOver] = useState<'bookmark' | 'before' | 'after' | null>(null);
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
        active ? 'bg-kumo-tint font-medium' : 'hover:bg-kumo-tint'
      } ${over === 'bookmark' ? 'ring-2 ring-kumo-brand' : ''} ${
        over === 'before' ? (horizontal ? 'shadow-[inset_3px_0_0_var(--color-kumo-brand)]' : 'shadow-[inset_0_3px_0_var(--color-kumo-brand)]') : ''
      } ${over === 'after' ? (horizontal ? 'shadow-[inset_-3px_0_0_var(--color-kumo-brand)]' : 'shadow-[inset_0_-3px_0_var(--color-kumo-brand)]') : ''}`}
      style={active ? { boxShadow: `inset 3px 0 0 ${w.color}` } : undefined}
      aria-label={w.name}
    >
      {label !== 'name' && <WorkspaceIcon ws={w} size={22} />}
      {label !== 'icon' && <span className={`truncate ${horizontal ? 'max-w-40' : 'flex-1'}`}>{w.name}</span>}
      {label !== 'icon' && w.adult && <span className="text-[10px] text-kumo-danger">18+</span>}
    </button>
  );
  const tip = [label === 'icon' ? w.name : '', w.description].filter(Boolean).join(' · ');
  return tip ? <Tooltip content={tip} side={horizontal ? 'bottom' : 'right'}>{btn}</Tooltip> : btn;
}
