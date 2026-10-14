import { PALETTE, type Bookmark, type Drawer, type NavillDB, type OutboxItem, type Placement, type SyncEntity, type Workspace } from '@/src/db';
import { ensureInbox, ensureSeed } from '../store/seed';
import { uid } from '../store/core';
import type { ImportPlan, PlannedBookmark, PlannedDrawer } from './plan';

export { ensureInbox };

export interface CommitResult { workspaces: number; drawers: number; bookmarks: number; skipped: number }
export interface CommitOptions {
  /** 重新导入：按 URL 去重，已有的书签跳过 */
  dedupe?: boolean;
}

/** 把导入计划写入本地 IndexedDB（单个事务，失败整体回滚） */
export async function commitImport(db: NavillDB, plan: ImportPlan, opts: CommitOptions = {}): Promise<CommitResult> {
  await ensureSeed(db);
  const now = Date.now();
  const result: CommitResult = { workspaces: 0, drawers: 0, bookmarks: 0, skipped: 0 };

  await db.transaction('rw', db.tables, async () => {
    const inbox = await ensureInbox(db);
    const all = await db.workspaces.toArray();
    const regular = all.filter((w) => w.source !== 'inbox');
    let wsOrder = regular.reduce((m, w) => Math.max(m, w.order), -1) + 1;
    let colorIndex = regular.length;

    const seen = new Set<string>();
    if (opts.dedupe) for (const b of await db.bookmarks.toArray()) seen.add(b.url);
    const keep = (list: PlannedBookmark[]) => {
      if (!opts.dedupe) return list;
      return list.filter((b) => {
        if (seen.has(b.url)) {
          result.skipped++;
          return false;
        }
        seen.add(b.url);
        return true;
      });
    };

    const workspaces: Workspace[] = [];
    const drawers: Drawer[] = [];
    const bookmarks: Bookmark[] = [];
    const placements: Placement[] = [];

    const addBookmarks = (list: PlannedBookmark[], workspaceId: string, drawerId: string | null, startOrder = 0) => {
      list.forEach((b, i) => {
        const id = uid();
        bookmarks.push({ id, url: b.url, title: b.title, tagIds: [], openCount: 0, createdAt: b.dateAdded ?? now, updatedAt: now });
        placements.push({ id: uid(), bookmarkId: id, workspaceId, drawerId, order: startOrder + i, isAlias: false, updatedAt: now });
      });
    };
    const addDrawer = (d: PlannedDrawer, list: PlannedBookmark[], workspaceId: string, order: number) => {
      const id = uid();
      drawers.push({ id, workspaceId, name: d.name, path: d.path, order, collapsed: false, sourceNodeId: d.key, updatedAt: now });
      addBookmarks(list, workspaceId, id);
    };

    for (const w of plan.workspaces) {
      if (!w.include) continue;
      const top = keep(w.topLevel);
      const ds = w.drawers.map((d) => ({ d, list: keep(d.bookmarks) })).filter((x) => x.list.length > 0);
      if (top.length === 0 && ds.length === 0) continue;
      const id = uid();
      workspaces.push({
        id, name: w.name.trim() || '未命名工作区', color: PALETTE[colorIndex++ % PALETTE.length], order: wsOrder++,
        viewMode: 'tile', source: w.source, sourceNodeId: w.sourceNodeId, createdAt: now, updatedAt: now,
      });
      addBookmarks(top, id, null);
      ds.forEach(({ d, list }, i) => addDrawer(d, list, id, i));
    }

    // 「待整理」按来源分抽屉；同名抽屉已存在时追加到末尾
    const inboxDrawers = await db.drawers.where('workspaceId').equals(inbox.id).toArray();
    let inboxOrder = inboxDrawers.reduce((m, d) => Math.max(m, d.order), -1) + 1;
    for (const d of plan.inbox) {
      const list = keep(d.bookmarks);
      if (list.length === 0) continue;
      const same = inboxDrawers.find((x) => x.name === d.name);
      if (same) {
        const count = await db.placements.where('drawerId').equals(same.id).count();
        addBookmarks(list, inbox.id, same.id, count);
      } else {
        addDrawer(d, list, inbox.id, inboxOrder++);
      }
    }

    await db.workspaces.bulkAdd(workspaces);
    await db.drawers.bulkAdd(drawers);
    await db.bookmarks.bulkAdd(bookmarks);
    await db.placements.bulkAdd(placements);
    const outbox: OutboxItem[] = [];
    const log = (entity: SyncEntity, rows: { id: string }[]) =>
      rows.forEach((r) => outbox.push({ id: `${entity}:${r.id}`, entity, entityId: r.id, op: 'put', updatedAt: now }));
    log('workspaces', workspaces);
    log('drawers', drawers);
    log('bookmarks', bookmarks);
    log('placements', placements);
    await db.outbox.bulkPut(outbox);
    await db.meta.put({ key: 'importedAt', value: now });

    Object.assign(result, { workspaces: workspaces.length, drawers: drawers.length, bookmarks: bookmarks.length });
  });
  return result;
}

/** 跳过导入：只建「待整理」等系统数据，标记已完成首次引导 */
export async function skipImport(db: NavillDB): Promise<void> {
  await ensureSeed(db);
  await db.meta.put({ key: 'onboardedAt', value: Date.now() });
}
