import type { NavillDB, Placement } from '@/src/db';
import { del, patch, put, tx, uid } from './core';
import { logged, q } from '../log';

import { tr } from '@/src/i18n';
async function where(db: NavillDB, workspaceId: string, drawerId: string | null) {
  const ws = await db.workspaces.get(workspaceId);
  const d = drawerId ? await db.drawers.get(drawerId) : undefined;
  return q(d ? `${ws?.name ?? ''} / ${d.name}` : ws?.name);
}

/** 某个位置（工作区顶层或抽屉）下按 order 排好的放置记录 */
export async function placementsAt(db: NavillDB, workspaceId: string, drawerId: string | null): Promise<Placement[]> {
  if (drawerId) return db.placements.where('drawerId').equals(drawerId).sortBy('order');
  const all = await db.placements.where('workspaceId').equals(workspaceId).toArray();
  return all.filter((p) => p.drawerId === null).sort((a, b) => a.order - b.order);
}

export async function nextOrder(db: NavillDB, workspaceId: string, drawerId: string | null): Promise<number> {
  const list = await placementsAt(db, workspaceId, drawerId);
  return list.reduce((m, p) => Math.max(m, p.order), -1) + 1;
}

/** 按给定 id 顺序重写 order */
export async function reorderPlacements(db: NavillDB, ids: string[]) {
  await tx(db, async () => {
    for (const [i, id] of ids.entries()) await patch<Placement>(db, 'placements', id, { order: i });
  });
}

/**
 * 删除一个位置。若删的是原书签位置且还有分身，最早的分身升级为原书签；
 * 若这是书签的最后一个位置，书签本身一并删除。
 */
export async function removePlacement(db: NavillDB, placementId: string) {
  await logged(db, async (log) => {
    const p = await db.placements.get(placementId);
    if (!p) return;
    const b = await db.bookmarks.get(p.bookmarkId);
    log({ kind: 'delete', targetType: 'bookmark', targetId: p.bookmarkId, summary: tr('删除{0}{1}', p.isAlias ? '分身' : '书签', q(b?.title)) });
    await del(db, 'placements', p.id);
    const rest = await db.placements.where('bookmarkId').equals(p.bookmarkId).toArray();
    if (rest.length === 0) {
      await del(db, 'bookmarks', p.bookmarkId);
      return;
    }
    if (!p.isAlias && rest.every((r) => r.isAlias)) {
      const promote = rest.sort((a, b) => a.updatedAt - b.updatedAt)[0]!;
      await patch<Placement>(db, 'placements', promote.id, { isAlias: false });
    }
  });
}

/** 移动一个位置到目标工作区 / 抽屉（null = 顶层），可指定插入位置 */
export async function movePlacement(
  db: NavillDB, placementId: string, workspaceId: string, drawerId: string | null, index?: number,
) {
  await logged(db, async (log) => {
    const p = await db.placements.get(placementId);
    if (!p) return;
    if (p.workspaceId !== workspaceId || p.drawerId !== drawerId) {
      const b = await db.bookmarks.get(p.bookmarkId);
      log({ kind: 'move', targetType: 'bookmark', targetId: p.bookmarkId, summary: tr('书签{0}移动到{1}', q(b?.title), await where(db, workspaceId, drawerId)) });
    }
    const target = (await placementsAt(db, workspaceId, drawerId)).filter((x) => x.id !== p.id);
    // 同一位置已有该书签的另一个放置（分身）时，不重复
    if (target.some((x) => x.bookmarkId === p.bookmarkId)) return;
    const at = index === undefined ? target.length : Math.max(0, Math.min(index, target.length));
    target.splice(at, 0, p);
    await patch<Placement>(db, 'placements', p.id, { workspaceId, drawerId });
    for (const [i, x] of target.entries()) {
      if (x.order !== i || x.id === p.id) await patch<Placement>(db, 'placements', x.id, { order: i });
    }
  });
}

/**
 * 拖拽放下：把位置移到目标处（跨位置时），再按 ids 给目标处的位置排顺序。
 * 目标处已有该书签的分身时不移动，也不改顺序。
 */
export async function placeInOrder(db: NavillDB, placementId: string, ids: string[], workspaceId: string, drawerId: string | null) {
  const p = await db.placements.get(placementId);
  if (!p) return;
  if (p.workspaceId !== workspaceId || p.drawerId !== drawerId) {
    await movePlacement(db, placementId, workspaceId, drawerId, ids.indexOf(placementId));
    const q = await db.placements.get(placementId);
    if (q?.workspaceId !== workspaceId || q.drawerId !== drawerId) return;
  }
  await reorderPlacements(db, ids);
}

/** 在目标位置创建分身；目标处已有该书签时跳过，返回新位置 id 或 null */
export async function createAlias(db: NavillDB, bookmarkId: string, workspaceId: string, drawerId: string | null) {
  return logged(db, async (log) => {
    const existing = await placementsAt(db, workspaceId, drawerId);
    if (existing.some((x) => x.bookmarkId === bookmarkId)) return null;
    const b = await db.bookmarks.get(bookmarkId);
    log({ kind: 'alias', targetType: 'bookmark', targetId: bookmarkId, summary: tr('为书签{0}创建分身到{1}', q(b?.title), await where(db, workspaceId, drawerId)) });
    const row = await put<Placement>(db, 'placements', {
      id: uid(), bookmarkId, workspaceId, drawerId, order: await nextOrder(db, workspaceId, drawerId),
      isAlias: true, updatedAt: 0,
    });
    return row.id;
  });
}
