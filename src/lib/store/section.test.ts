import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDB, type NavillDB } from '@/src/db';
import { loadWorkspace, visibilityOf } from '../view';
import { archiveSection, cloneSectionTo, createBookmark, createDrawer, createSection, createWorkspace, ensureSeed, moveSection, placeDrawerInSection } from './index';

let db: NavillDB;
let n = 0;
beforeEach(async () => {
  db = createDB(`section-${n++}`);
  await ensureSeed(db);
});

async function setup() {
  const ws = await createWorkspace(db, { name: '工作' });
  const other = await createWorkspace(db, { name: '生活' });
  const a = await createDrawer(db, ws.id, 'A');
  const b = await createDrawer(db, ws.id, 'B');
  await createBookmark(db, { url: 'x.com', title: 'X' }, ws.id, a.id);
  const s = await createSection(db, ws.id, '常用');
  await placeDrawerInSection(db, a.id, s.id, [a.id]);
  return { ws, other, a, b, s };
}

describe('分区', () => {
  it('移动到别的工作区：分区和抽屉、书签一起走', async () => {
    const { ws, other, a, b, s } = await setup();
    await moveSection(db, ws.id, s.id, other.id);
    expect((await db.workspaces.get(ws.id))!.sections).toEqual([]);
    expect((await db.workspaces.get(other.id))!.sections!.map((x) => x.id)).toEqual([s.id]);
    expect(await db.drawers.get(a.id)).toMatchObject({ workspaceId: other.id, sectionId: s.id });
    expect((await db.drawers.get(b.id))!.workspaceId).toBe(ws.id);
    expect((await db.placements.where('drawerId').equals(a.id).toArray()).every((p) => p.workspaceId === other.id)).toBe(true);
  });

  it('分身到别的工作区：同名分区，抽屉挂载源抽屉', async () => {
    const { ws, other, s } = await setup();
    await cloneSectionTo(db, ws.id, s.id, other.id);
    const ns = (await db.workspaces.get(other.id))!.sections!;
    expect(ns.map((x) => x.name)).toEqual(['常用']);
    const data = (await loadWorkspace(db, other.id, visibilityOf(undefined)))!;
    const A = data.drawers.find((d) => d.drawer.name === 'A')!;
    expect(A.drawer.sectionId).toBe(ns[0]!.id);
    expect(A.mounted.map((i) => i.bookmark.title)).toEqual(['X']);
  });

  it('归档：抽屉归档，分区去掉', async () => {
    const { ws, a, b, s } = await setup();
    await archiveSection(db, ws.id, s.id);
    expect((await db.workspaces.get(ws.id))!.sections).toEqual([]);
    expect((await db.drawers.get(a.id))!.archivedAt).toBeTruthy();
    expect((await db.drawers.get(b.id))!.archivedAt).toBeFalsy();
  });
});
