import type { Bookmark, Drawer, NavillDB, Placement, Workspace } from '@/src/db';
import { INBOX_NAME, INBOX_ORDER } from '@/src/db';
import type { ImportPlan, PlannedBookmark, PlannedDrawer } from './plan';

const uid = () => crypto.randomUUID();

/** 确保系统工作区「待整理」存在（始终存在、不可删除） */
export async function ensureInbox(db: NavillDB): Promise<Workspace> {
  return db.transaction('rw', db.workspaces, async () => {
    const existing = await db.workspaces.where('source').equals('inbox').first();
    if (existing) return existing;
    const inbox: Workspace = {
      id: uid(), name: INBOX_NAME, order: INBOX_ORDER, viewMode: 'tile', source: 'inbox', createdAt: Date.now(),
    };
    await db.workspaces.add(inbox);
    return inbox;
  });
}

export interface CommitResult { workspaces: number; drawers: number; bookmarks: number }

/** 把导入计划写入本地 IndexedDB（单个事务，失败整体回滚） */
export async function commitImport(db: NavillDB, plan: ImportPlan): Promise<CommitResult> {
  const now = Date.now();
  const result: CommitResult = { workspaces: 0, drawers: 0, bookmarks: 0 };

  await db.transaction('rw', [db.workspaces, db.drawers, db.bookmarks, db.placements, db.meta], async () => {
    const inbox = await ensureInbox(db);
    const regular = await db.workspaces.where('source').notEqual('inbox').toArray();
    let wsOrder = regular.reduce((m, w) => Math.max(m, w.order), -1) + 1;

    const workspaces: Workspace[] = [];
    const drawers: Drawer[] = [];
    const bookmarks: Bookmark[] = [];
    const placements: Placement[] = [];

    const addBookmarks = (list: PlannedBookmark[], workspaceId: string, drawerId: string | null, startOrder = 0) => {
      list.forEach((b, i) => {
        const id = uid();
        const created = b.dateAdded ?? now;
        bookmarks.push({ id, url: b.url, title: b.title, tagIds: [], openCount: 0, createdAt: created, updatedAt: now });
        placements.push({ id: uid(), bookmarkId: id, workspaceId, drawerId, order: startOrder + i, isAlias: false });
      });
    };
    const addDrawers = (list: PlannedDrawer[], workspaceId: string, startOrder = 0) => {
      list.forEach((d, i) => {
        const id = uid();
        drawers.push({ id, workspaceId, name: d.name, path: d.path, order: startOrder + i, collapsed: false, sourceNodeId: d.key });
        addBookmarks(d.bookmarks, workspaceId, id);
      });
    };

    for (const w of plan.workspaces) {
      if (!w.include) continue;
      const id = uid();
      workspaces.push({
        id, name: w.name.trim() || '未命名工作区', order: wsOrder++, viewMode: 'tile',
        source: w.source, sourceNodeId: w.sourceNodeId, createdAt: now,
      });
      addBookmarks(w.topLevel, id, null);
      addDrawers(w.drawers, id);
    }

    // 「待整理」按来源分抽屉；同名抽屉已存在时追加到末尾
    const inboxDrawers = await db.drawers.where('workspaceId').equals(inbox.id).toArray();
    let inboxOrder = inboxDrawers.reduce((m, d) => Math.max(m, d.order), -1) + 1;
    for (const d of plan.inbox) {
      const same = inboxDrawers.find((x) => x.name === d.name);
      if (same) {
        const count = await db.placements.where('drawerId').equals(same.id).count();
        addBookmarks(d.bookmarks, inbox.id, same.id, count);
      } else {
        addDrawers([d], inbox.id, inboxOrder++);
      }
    }

    await db.workspaces.bulkAdd(workspaces);
    await db.drawers.bulkAdd(drawers);
    await db.bookmarks.bulkAdd(bookmarks);
    await db.placements.bulkAdd(placements);
    await db.meta.put({ key: 'importedAt', value: now });

    Object.assign(result, { workspaces: workspaces.length, drawers: drawers.length, bookmarks: bookmarks.length });
  });
  return result;
}

/** 跳过导入：只建「待整理」，标记已完成首次引导 */
export async function skipImport(db: NavillDB): Promise<void> {
  await ensureInbox(db);
  await db.meta.put({ key: 'onboardedAt', value: Date.now() });
}
