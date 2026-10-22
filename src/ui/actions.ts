import { Archive, Copy, ExternalLink, Eye, Move, Pencil, RotateCcw, Tag, Trash2, Unlink } from 'lucide-react';
import { db } from '@/src/db';
import {
  archiveBookmark, createAlias, deleteBookmarkEverywhere, detachAlias, movePlacement, removePlacement,
} from '@/src/lib/store';
import type { Item } from '@/src/lib/view';
import type { MenuItem } from './ContextMenu';
import type { useDialogs } from './dialogs';
import { openItem } from './open';
import type { Settings } from '@/src/lib/settings';

import { tr } from '@/src/i18n';
type Dialogs = ReturnType<typeof useDialogs>;

export async function askDelete(d: Dialogs, item: Item) {
  if (item.placement.isAlias) {
    if (await d.confirm({ title: tr('删除这个分身？'), description: tr('只删除这一处，原书签和其他分身不受影响。'), okText: tr('删除'), danger: true })) {
      await removePlacement(db, item.placement.id);
    }
    return;
  }
  const others = await db.placements.where('bookmarkId').equals(item.bookmark.id).count();
  if (others <= 1) {
    if (await d.confirm({ title: tr('删除「{0}」？', item.bookmark.title), okText: tr('删除'), danger: true })) await removePlacement(db, item.placement.id);
    return;
  }
  const choice = await d.choose({
    title: tr('删除「{0}」', item.bookmark.title),
    description: tr('这个书签还有 {0} 个分身。', others - 1),
    choices: [
      { value: 'here', label: tr('仅删此处，由一个分身接任原书签') },
      { value: 'all', label: tr('删除原书签及全部分身'), danger: true },
    ],
  });
  if (choice === 'here') await removePlacement(db, item.placement.id);
  if (choice === 'all') await deleteBookmarkEverywhere(db, item.bookmark.id);
}

export async function aliasTo(d: Dialogs, bookmarkIds: string[]) {
  const t = await d.pickTarget({ title: tr('分身到…'), allowTop: true });
  if (!t) return;
  for (const id of bookmarkIds) await createAlias(db, id, t.workspaceId, t.drawerId);
}

export async function moveTo(d: Dialogs, placementIds: string[]) {
  const t = await d.pickTarget({ title: tr('移动到…'), allowTop: true });
  if (!t) return;
  for (const id of placementIds) await movePlacement(db, id, t.workspaceId, t.drawerId);
}

/** 书签 / 分身 / 挂载书签的右键菜单 */
export function bookmarkMenu(
  item: Item, d: Dialogs, settings: Settings, extra: { onReveal?: (item: Item) => void } = {},
): MenuItem[] {
  const open: MenuItem = { label: tr('在新标签页打开'), icon: ExternalLink, onSelect: () => void openItem(item, settings, { shiftKey: true }) };
  if (item.mountedFrom) {
    return [
      open,
      { divider: true },
      { label: tr('分身到…'), icon: Copy, onSelect: () => void aliasTo(d, [item.bookmark.id]) },
      { label: tr('在源抽屉「{0}」中显示', item.mountedFrom.drawer.name), icon: Eye, onSelect: () => extra.onReveal?.(item) },
    ];
  }
  if (item.bookmark.archivedAt) {
    return [
      open,
      { divider: true },
      { label: tr('恢复'), icon: RotateCcw, onSelect: () => void archiveBookmark(db, item.bookmark.id, false) },
      { divider: true },
      { label: tr('彻底删除'), icon: Trash2, danger: true, onSelect: () => void deleteForever(d, item) },
    ];
  }
  if (item.placement.isAlias) {
    return [
      open,
      { divider: true },
      { label: tr('分身到…'), icon: Copy, onSelect: () => void aliasTo(d, [item.bookmark.id]) },
      { label: tr('移动'), icon: Move, onSelect: () => void moveTo(d, [item.placement.id]) },
      { label: tr('转为独立书签'), icon: Unlink, onSelect: () => void detachAlias(db, item.placement.id) },
      { divider: true },
      { label: tr('删除'), icon: Trash2, danger: true, onSelect: () => void askDelete(d, item) },
    ];
  }
  return [
    open,
    { divider: true },
    { label: tr('编辑'), icon: Pencil, onSelect: () => d.editBookmark(item.bookmark.id) },
    { label: tr('标签…'), icon: Tag, onSelect: () => d.editTags([item.bookmark.id]) },
    { divider: true },
    { label: tr('分身到…'), icon: Copy, onSelect: () => void aliasTo(d, [item.bookmark.id]) },
    { label: tr('移动'), icon: Move, onSelect: () => void moveTo(d, [item.placement.id]) },
    { label: tr('归档'), icon: Archive, onSelect: () => void archiveBookmark(db, item.bookmark.id) },
    { divider: true },
    { label: tr('删除'), icon: Trash2, danger: true, onSelect: () => void askDelete(d, item) },
  ];
}

async function deleteForever(d: Dialogs, item: Item) {
  if (await d.confirm({ title: tr('彻底删除「{0}」？', item.bookmark.title), description: tr('原书签及全部分身都会删除，不可恢复。'), okText: tr('删除'), danger: true })) {
    await deleteBookmarkEverywhere(db, item.bookmark.id);
  }
}
