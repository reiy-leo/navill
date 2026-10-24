import { MODE_DEFAULT, type Drawer, type NavillDB, type Placement, type SortMode, type ViewMode } from '@/src/db';
import { del, patch, put, tx, uid } from './core';
import { hideEverywhereExcept } from './mode';
import { nextOrder, placementsAt, removePlacement } from './placement';
import { logged, q } from '../log';

import { tr } from '@/src/i18n';
export async function createDrawer(db: NavillDB, workspaceId: string, name: string, onlyInMode?: string, color?: string, description?: string) {
  return logged(db, async (log) => {
    const siblings = await db.drawers.where('workspaceId').equals(workspaceId).toArray();
    const n = name.trim() || tr('新抽屉');
    const d = await put<Drawer>(db, 'drawers', {
      id: uid(), workspaceId, name: n, path: [n], order: siblings.reduce((m, x) => Math.max(m, x.order), -1) + 1,
      collapsed: false, color, description: description?.trim() || undefined, updatedAt: 0,
    });
    if (onlyInMode && onlyInMode !== MODE_DEFAULT) await hideEverywhereExcept(db, 'drawer', d.id, onlyInMode);
    log({ kind: 'create', targetType: 'drawer', targetId: d.id, summary: tr('新建抽屉{0}', q(n)) });
    return d;
  });
}

export async function renameDrawer(db: NavillDB, id: string, name: string) {
  const n = name.trim();
  if (!n) return;
  await logged(db, async (log) => {
    const d = await db.drawers.get(id);
    if (!d) return;
    await patch<Drawer>(db, 'drawers', id, { name: n, path: n.split(' / ') });
    log({ kind: 'rename', targetType: 'drawer', targetId: id, summary: tr('抽屉{0}改名为{1}', q(d.name), q(n)) });
  });
}

export async function updateDrawer(
  db: NavillDB, id: string,
  changes: Partial<Pick<Drawer, 'collapsed' | 'adult' | 'color' | 'description'>> & { viewMode?: ViewMode | null; sortMode?: SortMode; height?: number | null },
) {
  const c: Partial<Drawer> = { ...changes, viewMode: changes.viewMode ?? undefined, height: changes.height ?? undefined };
  if (changes.viewMode === undefined) delete c.viewMode;
  if (changes.height === undefined) delete c.height;
  await patch<Drawer>(db, 'drawers', id, c);
}

/** 归档 / 取消归档抽屉 */
export async function archiveDrawer(db: NavillDB, id: string, archived = true) {
  await logged(db, async (log) => {
    const d = await db.drawers.get(id);
    if (!d) return;
    await patch<Drawer>(db, 'drawers', id, { archivedAt: archived ? Date.now() : undefined });
    log({ kind: archived ? 'archive' : 'restore', targetType: 'drawer', targetId: id, summary: archived ? tr('归档抽屉{0}', q(d.name)) : tr('恢复抽屉{0}', q(d.name)) });
  });
}

export async function reorderDrawers(db: NavillDB, ids: string[]) {
  await tx(db, async () => {
    for (const [i, id] of ids.entries()) await patch<Drawer>(db, 'drawers', id, { order: i });
  });
}

/** 移动抽屉到另一个工作区（排到末尾） */
export async function moveDrawer(db: NavillDB, id: string, workspaceId: string) {
  await logged(db, async (log) => {
    const d = await db.drawers.get(id);
    if (!d || d.workspaceId === workspaceId) return;
    const ws = await db.workspaces.get(workspaceId);
    log({ kind: 'move', targetType: 'drawer', targetId: id, summary: tr('抽屉{0}移动到工作区{1}', q(d.name), q(ws?.name)) });
    const siblings = await db.drawers.where('workspaceId').equals(workspaceId).toArray();
    await patch<Drawer>(db, 'drawers', id, { workspaceId, order: siblings.reduce((m, x) => Math.max(m, x.order), -1) + 1 });
    const ps = await db.placements.where('drawerId').equals(id).toArray();
    for (const p of ps) await patch<Placement>(db, 'placements', p.id, { workspaceId });
  });
}

async function dropAliasGroups(db: NavillDB, drawerId: string) {
  const groups = [
    ...(await db.aliasGroups.where('sourceDrawerId').equals(drawerId).toArray()),
    ...(await db.aliasGroups.where('targetDrawerId').equals(drawerId).toArray()),
  ];
  for (const g of groups) await del(db, 'aliasGroups', g.id);
}

/** 解散：删除抽屉本身，书签移到所在工作区顶层 */
export async function dissolveDrawer(db: NavillDB, id: string) {
  await logged(db, async (log) => {
    const d = await db.drawers.get(id);
    if (!d) return;
    log({ kind: 'delete', targetType: 'drawer', targetId: id, summary: tr('解散抽屉{0}', q(d.name)) });
    const items = await placementsAt(db, d.workspaceId, id);
    const top = await placementsAt(db, d.workspaceId, null);
    const topBookmarks = new Set(top.map((p) => p.bookmarkId));
    let order = await nextOrder(db, d.workspaceId, null);
    for (const p of items) {
      if (topBookmarks.has(p.bookmarkId)) await removePlacement(db, p.id);
      else await patch<Placement>(db, 'placements', p.id, { drawerId: null, order: order++ });
    }
    await dropAliasGroups(db, id);
    await del(db, 'drawers', id);
  });
}

/** 删除：抽屉连同书签一起删除（原书签有分身时由分身接任） */
export async function deleteDrawer(db: NavillDB, id: string) {
  await logged(db, async (log) => {
    const d = await db.drawers.get(id);
    if (d) log({ kind: 'delete', targetType: 'drawer', targetId: id, summary: tr('删除抽屉{0}', q(d.name)) });
    const items = await db.placements.where('drawerId').equals(id).toArray();
    for (const p of items) await removePlacement(db, p.id);
    await dropAliasGroups(db, id);
    await del(db, 'drawers', id);
  });
}

/** 打乱：随机重排一次，排序切回手动 */
export async function shuffleDrawer(db: NavillDB, workspaceId: string, drawerId: string | null, random = Math.random) {
  await tx(db, async () => {
    const items = await placementsAt(db, workspaceId, drawerId);
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [items[i], items[j]] = [items[j]!, items[i]!];
    }
    for (const [i, p] of items.entries()) await patch<Placement>(db, 'placements', p.id, { order: i });
    if (drawerId) await patch<Drawer>(db, 'drawers', drawerId, { sortMode: 'manual' });
  });
}
