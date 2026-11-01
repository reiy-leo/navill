import type { NavillDB, Placement } from '@/src/db';
import { del, patch, put, tx, uid } from './core';
import { logged, q } from '../log';

import { tr } from '@/src/i18n';
async function where(db: NavillDB, workspaceId: string, drawerId: string | null, sectionId?: string | null) {
  const ws = await db.workspaces.get(workspaceId);
  const d = drawerId ? await db.drawers.get(drawerId) : undefined;
  const s = !drawerId && sectionId ? ws?.sections?.find((x) => x.id === sectionId) : undefined;
  const sub = d?.name ?? s?.name;
  return q(sub ? `${ws?.name ?? ''} / ${sub}` : ws?.name);
}

/**
 * 往抽屉里写书签时真正该写到哪：分身抽屉（只挂载了一个源抽屉）写回源抽屉，
 * 这样原抽屉和其他分身都能看到；源抽屉本身也是分身时继续往上找。返回 null 表示就写这个抽屉。
 */
export async function aliasSource(db: NavillDB, drawerId: string): Promise<{ workspaceId: string; drawerId: string } | null> {
  let cur = drawerId;
  const seen = new Set<string>();
  for (;;) {
    seen.add(cur);
    const gs = await db.aliasGroups.where('targetDrawerId').equals(cur).toArray();
    if (gs.length !== 1 || seen.has(gs[0]!.sourceDrawerId)) break;
    const src = await db.drawers.get(gs[0]!.sourceDrawerId);
    if (!src) break;
    cur = src.id;
  }
  if (cur === drawerId) return null;
  const d = await db.drawers.get(cur);
  return d ? { workspaceId: d.workspaceId, drawerId: d.id } : null;
}

/** 不在抽屉里的书签实际所在的分区：分区已不存在时算顶层（null） */
export function sectionOf(p: Placement, known: Set<string>): string | null {
  return p.drawerId === null && p.sectionId && known.has(p.sectionId) ? p.sectionId : null;
}

/** 某个位置（工作区顶层、分区或抽屉）下按 order 排好的放置记录；sectionId 只在 drawerId 为 null 时有意义 */
export async function placementsAt(db: NavillDB, workspaceId: string, drawerId: string | null, sectionId: string | null = null): Promise<Placement[]> {
  if (drawerId) return db.placements.where('drawerId').equals(drawerId).sortBy('order');
  const known = new Set((await db.workspaces.get(workspaceId))?.sections?.map((s) => s.id) ?? []);
  const all = await db.placements.where('workspaceId').equals(workspaceId).toArray();
  return all.filter((p) => p.drawerId === null && sectionOf(p, known) === sectionId).sort((a, b) => a.order - b.order);
}

export async function nextOrder(db: NavillDB, workspaceId: string, drawerId: string | null, sectionId: string | null = null): Promise<number> {
  const list = await placementsAt(db, workspaceId, drawerId, sectionId);
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
    log({ kind: 'delete', targetType: 'bookmark', targetId: p.bookmarkId, summary: p.isAlias ? tr('删除分身{0}', q(b?.title)) : tr('删除书签{0}', q(b?.title)) });
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

const sameSpot = (p: Placement, workspaceId: string, drawerId: string | null, sectionId: string | null) =>
  p.workspaceId === workspaceId && p.drawerId === drawerId && (drawerId !== null || (p.sectionId ?? null) === sectionId);

/** 移动一个位置到目标工作区 / 抽屉（null = 顶层；再给 sectionId 则是分区），可指定插入位置 */
export async function movePlacement(
  db: NavillDB, placementId: string, workspaceId: string, drawerId: string | null, index?: number, sectionId: string | null = null,
) {
  if (drawerId) {
    sectionId = null;
    const src = await aliasSource(db, drawerId);
    if (src) { ({ workspaceId, drawerId } = src); index = undefined; }
  }
  await logged(db, async (log) => {
    const p = await db.placements.get(placementId);
    if (!p) return;
    if (!sameSpot(p, workspaceId, drawerId, sectionId)) {
      const b = await db.bookmarks.get(p.bookmarkId);
      log({ kind: 'move', targetType: 'bookmark', targetId: p.bookmarkId, summary: tr('书签{0}移动到{1}', q(b?.title), await where(db, workspaceId, drawerId, sectionId)) });
    }
    const target = (await placementsAt(db, workspaceId, drawerId, sectionId)).filter((x) => x.id !== p.id);
    // 同一位置已有该书签的另一个放置（分身）时，不重复
    if (target.some((x) => x.bookmarkId === p.bookmarkId)) return;
    const at = index === undefined ? target.length : Math.max(0, Math.min(index, target.length));
    target.splice(at, 0, p);
    await patch<Placement>(db, 'placements', p.id, { workspaceId, drawerId, sectionId: sectionId ?? undefined });
    for (const [i, x] of target.entries()) {
      if (x.order !== i || x.id === p.id) await patch<Placement>(db, 'placements', x.id, { order: i });
    }
  });
}

/**
 * 拖拽放下：把位置移到目标处（跨位置时），再按 ids 给目标处的位置排顺序。
 * 目标处已有该书签的分身时不移动，也不改顺序。
 */
export async function placeInOrder(db: NavillDB, placementId: string, ids: string[], workspaceId: string, drawerId: string | null, sectionId: string | null = null) {
  if (drawerId) sectionId = null;
  const p = await db.placements.get(placementId);
  if (!p) return;
  // 拖进分身抽屉：书签放到源抽屉末尾，分身抽屉里的顺序跟着源抽屉走，不按这边的落点排
  const src = drawerId ? await aliasSource(db, drawerId) : null;
  if (src) { if (!sameSpot(p, src.workspaceId, src.drawerId, null)) await movePlacement(db, placementId, src.workspaceId, src.drawerId); return; }
  if (!sameSpot(p, workspaceId, drawerId, sectionId)) {
    await movePlacement(db, placementId, workspaceId, drawerId, ids.indexOf(placementId), sectionId);
    const q = await db.placements.get(placementId);
    if (!q || !sameSpot(q, workspaceId, drawerId, sectionId)) return;
  }
  await reorderPlacements(db, ids);
}

/** 在目标位置创建分身；目标处已有该书签时跳过，返回新位置 id 或 null */
export async function createAlias(db: NavillDB, bookmarkId: string, workspaceId: string, drawerId: string | null, sectionId: string | null = null) {
  if (drawerId) {
    sectionId = null;
    const src = await aliasSource(db, drawerId);
    if (src) ({ workspaceId, drawerId } = src);
  }
  return logged(db, async (log) => {
    const existing = await placementsAt(db, workspaceId, drawerId, sectionId);
    if (existing.some((x) => x.bookmarkId === bookmarkId)) return null;
    const b = await db.bookmarks.get(bookmarkId);
    log({ kind: 'alias', targetType: 'bookmark', targetId: bookmarkId, summary: tr('为书签{0}创建分身到{1}', q(b?.title), await where(db, workspaceId, drawerId, sectionId)) });
    const row = await put<Placement>(db, 'placements', {
      id: uid(), bookmarkId, workspaceId, drawerId, order: await nextOrder(db, workspaceId, drawerId, sectionId),
      isAlias: true, updatedAt: 0, ...(sectionId ? { sectionId } : {}),
    });
    return row.id;
  });
}
