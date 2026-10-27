import { Archive, ChevronDown, ChevronRight, ChevronUp, Copy, FolderPlus, Move, Package } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { db, type Section, type Workspace } from '@/src/db';
import { archiveSection, cloneSectionTo, dissolveSection, moveSection, renameSection, reorderSections, shiftSection } from '@/src/lib/store';
import type { DrawerData } from '@/src/lib/view';
import { useContextMenu } from '@/src/ui/ContextMenu';
import { useDialogs } from '@/src/ui/dialogs';
import { useFlip, useSortable } from './sortable';

import { tr } from '@/src/i18n';

const DND_SECTION = 'application/x-navill-section';

/** 分区折叠状态只存本机 */
const KEY = 'navill-section-collapsed';
const readCollapsed = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]); } catch { return new Set(); }
};
function useCollapsed() {
  const [set, setSet] = useState(readCollapsed);
  useEffect(() => {
    const on = (e: StorageEvent) => { if (e.key === KEY) setSet(readCollapsed()); };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);
  const toggle = useCallback((id: string) => {
    setSet((old) => {
      const next = new Set(old);
      if (!next.delete(id)) next.add(id);
      localStorage.setItem(KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);
  return [set, toggle] as const;
}

/** 按 id 算出固定的小角度，让章看起来是随手盖上去的 */
function stampTilt(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return -1.5 - ((h >>> 0) % 25) / 10;
}

/**
 * 工作区里的分区：浅色底的区域圈住它的抽屉，名称像章一样盖在右下角（点击改名），
 * 章左边是折叠开关；拖动章给分区排序，右键章或区域空白处打开菜单。
 */
export function SectionList({ workspace, drawers, editing, onEdited, onNewDrawer, render }: {
  workspace: Workspace; drawers: DrawerData[]; editing: string | null; onEdited: () => void; onNewDrawer: (sectionId: string) => void;
  render: (sectionId: string, drawers: DrawerData[]) => ReactNode;
}) {
  const sections = workspace.sections ?? [];
  const ref = useRef<HTMLDivElement>(null);
  const [collapsed, toggle] = useCollapsed();
  const sort = useSortable({
    list: `sections:${workspace.id}`, kind: 'section', items: sections, keyOf: (s) => s.id, horizontal: false,
    onDrop: (_, ids) => void reorderSections(db, workspace.id, ids),
  });
  useFlip(ref, sort.sig, '[data-flip-section]');
  return (
    <div ref={ref} {...sort.container} className="flex flex-col gap-4">
      {sort.rows.map(({ t: s, ghost, hidden }, i) => (
        <SectionRegion
          key={s.id} workspace={workspace} section={s} index={i} count={sections.length}
          ghost={ghost} hidden={hidden} collapsed={collapsed.has(s.id)} onToggle={toggle}
          editing={editing === s.id} onEdited={onEdited} onNewDrawer={onNewDrawer} dnd={sort.bind(s.id)}
          drawers={drawers.filter((d) => d.drawer.sectionId === s.id).length}
        >
          {render(s.id, drawers.filter((d) => d.drawer.sectionId === s.id))}
        </SectionRegion>
      ))}
    </div>
  );
}

const SectionRegion = memo(function SectionRegion({
  workspace, section, index, count, ghost, hidden, collapsed, onToggle, editing, onEdited, onNewDrawer, dnd, drawers, children,
}: {
  workspace: Workspace; section: Section; index: number; count: number; ghost: boolean; hidden: boolean;
  collapsed: boolean; onToggle: (id: string) => void; editing: boolean; onEdited: () => void; onNewDrawer: (sectionId: string) => void; drawers: number;
  dnd: { onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void; onDragStart: () => void };
  children: ReactNode;
}) {
  const menu = useContextMenu();
  const dialogs = useDialogs();
  const [edit, setEdit] = useState(editing);
  const [name, setName] = useState(section.name);
  useEffect(() => { if (editing) setEdit(true); }, [editing]);
  useEffect(() => { if (!edit) setName(section.name); }, [section.name, edit]);
  const commit = () => {
    setEdit(false);
    onEdited();
    if (name.trim() && name.trim() !== section.name) void renameSection(db, workspace.id, section.id, name);
    else setName(section.name);
  };
  const ctx = (e: React.MouseEvent) =>
    menu(e, [
      { label: tr('新建抽屉'), icon: FolderPlus, onSelect: () => onNewDrawer(section.id) },
      { label: collapsed ? tr('展开分区') : tr('折叠分区'), icon: collapsed ? ChevronDown : ChevronRight, onSelect: () => onToggle(section.id) },
      { divider: true },
      { label: tr('上移'), icon: ChevronUp, disabled: index === 0, onSelect: () => void shiftSection(db, workspace.id, section.id, -1) },
      { label: tr('下移'), icon: ChevronDown, disabled: index === count - 1, onSelect: () => void shiftSection(db, workspace.id, section.id, 1) },
      { divider: true },
      {
        label: tr('移动到…'), icon: Move,
        onSelect: async () => {
          const t = await dialogs.pickTarget({ title: tr('移动分区到工作区…'), workspacesOnly: true });
          if (t && t.workspaceId !== workspace.id) await moveSection(db, workspace.id, section.id, t.workspaceId);
        },
      },
      {
        label: tr('分身到…'), icon: Copy,
        onSelect: async () => {
          const t = await dialogs.pickTarget({ title: tr('把分区「{0}」分身到工作区…', section.name), workspacesOnly: true });
          if (t && t.workspaceId !== workspace.id) await cloneSectionTo(db, workspace.id, section.id, t.workspaceId);
        },
      },
      {
        label: tr('归档'), icon: Archive,
        onSelect: async () => {
          if (await dialogs.confirm({ title: tr('归档分区「{0}」？', section.name), description: tr('里面的抽屉都会归档，分区去掉。以后可以在归档里恢复抽屉。'), okText: tr('归档') })) {
            await archiveSection(db, workspace.id, section.id);
          }
        },
      },
      { divider: true },
      {
        label: tr('解散'), icon: Package,
        onSelect: async () => {
          if (await dialogs.confirm({ title: tr('解散分区「{0}」？', section.name), description: tr('分区会去掉，其中的抽屉留在工作区里。'), okText: tr('解散') })) {
            await dissolveSection(db, workspace.id, section.id);
          }
        },
      },
    ]);

  const stamp = edit ? (
    <input
      autoFocus
      className="nv-stamp w-32 bg-kumo-base outline-none"
      style={{ rotate: '0deg' }}
      value={name}
      onChange={(e) => setName(e.target.value)}
      onBlur={commit}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') { setName(section.name); setEdit(false); onEdited(); }
      }}
      aria-label={tr('分区名称')}
    />
  ) : (
    <button
      type="button"
      draggable
      className="nv-stamp"
      style={{ rotate: `${stampTilt(section.id)}deg` }}
      title={section.name}
      onClick={() => setEdit(true)}
      onContextMenu={ctx}
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_SECTION, section.id);
        e.dataTransfer.effectAllowed = 'move';
        dnd.onDragStart();
      }}
    >
      {section.name}
    </button>
  );

  return (
    <section
      data-flip={section.id}
      data-flip-section=""
      aria-label={section.name}
      onDragOver={dnd.onDragOver}
      onDrop={dnd.onDrop}
      onContextMenu={(e) => { if (e.target === e.currentTarget) ctx(e); }}
      className={`nv-section relative rounded-2xl ${collapsed ? 'px-3 py-2' : 'p-3 pb-10'} ${ghost ? 'nv-ghost' : ''} ${hidden ? 'hidden' : ''}`}
    >
      {!collapsed && children}
      <div className={`${collapsed ? 'flex justify-end' : 'absolute bottom-2 right-3'} flex items-center gap-1.5`}>
        {collapsed && <span className="text-xs text-kumo-subtle">{tr('{0} 个抽屉', drawers)}</span>}
        <button
          type="button"
          className="flex size-5 items-center justify-center rounded text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default"
          aria-label={collapsed ? tr('展开分区') : tr('折叠分区')}
          aria-expanded={!collapsed}
          onClick={() => onToggle(section.id)}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        {stamp}
      </div>
    </section>
  );
});
