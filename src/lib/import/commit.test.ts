import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDB, type NavillDB } from '@/src/db';
import { bm, folder, root } from '../test-tree';
import { commitImport, ensureInbox } from './commit';
import { buildImportPlan } from './plan';

let db: NavillDB;
let n = 0;
beforeEach(() => {
  db = createDB(`test-${n++}`);
});

const tree = root([
  folder('1', '书签栏', [
    bm('b1', '散放'),
    folder('f1', '工作', [bm('b2', '顶层'), folder('f2', '项目', [bm('b3', 'A'), bm('b4', 'B')])]),
  ]),
]);

describe('commitImport', () => {
  it('写入工作区、抽屉、书签与位置，「待整理」排在末尾', async () => {
    const res = await commitImport(db, buildImportPlan(tree));
    expect(res).toEqual({ workspaces: 1, drawers: 2, bookmarks: 4, skipped: 0 });

    const ws = await db.workspaces.orderBy('order').toArray();
    expect(ws.map((w) => w.name)).toEqual(['工作', '待整理']);

    const work = ws[0]!;
    const top = await db.placements.where({ workspaceId: work.id }).filter((p) => p.drawerId === null).toArray();
    expect(top).toHaveLength(1);

    const drawer = (await db.drawers.where('workspaceId').equals(work.id).first())!;
    const inDrawer = await db.placements.where('drawerId').equals(drawer.id).sortBy('order');
    const titles = await Promise.all(inDrawer.map(async (p) => (await db.bookmarks.get(p.bookmarkId))!.title));
    expect(titles).toEqual(['A', 'B']);
    expect(await db.meta.get('importedAt')).toBeTruthy();
  });

  it('「待整理」只有一个；再次导入时同名来源抽屉追加', async () => {
    await ensureInbox(db);
    await commitImport(db, buildImportPlan(tree));
    await commitImport(db, buildImportPlan(tree));
    expect(await db.workspaces.where('source').equals('inbox').count()).toBe(1);
    const inbox = (await db.workspaces.where('source').equals('inbox').first())!;
    const drawers = await db.drawers.where('workspaceId').equals(inbox.id).toArray();
    expect(drawers.map((d) => d.name)).toEqual(['书签栏']);
    const orders = (await db.placements.where('drawerId').equals(drawers[0]!.id).toArray()).map((p) => p.order).sort();
    expect(orders).toEqual([0, 1]);
  });

  it('未勾选的工作区不导入', async () => {
    const plan = buildImportPlan(tree);
    plan.workspaces[0]!.include = false;
    const res = await commitImport(db, plan);
    expect(res.workspaces).toBe(0);
    expect(res.bookmarks).toBe(1);
  });
});

describe('重新导入去重', () => {
  it('按 URL 跳过已有书签，空抽屉和空工作区不再新建', async () => {
    await commitImport(db, buildImportPlan(tree));
    const res = await commitImport(db, buildImportPlan(tree), { dedupe: true });
    expect(res).toEqual({ workspaces: 0, drawers: 0, bookmarks: 0, skipped: 4 });
    expect(await db.bookmarks.count()).toBe(4);
  });
});
