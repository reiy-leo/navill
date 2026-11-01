import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDB, type NavillDB } from '@/src/db';
import { loadWorkspace, visibilityOf } from '../view';
import { archiveSection, cloneSectionTo, createBookmark, createDrawer, createSection, createWorkspace, dissolveSection, ensureSeed, mergeAsLink, moveSection, placeDrawerInSection, placeInOrder } from './index';

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

describe('抽屉分身到工作区', () => {
  it('那边新建同名抽屉并挂载，可放进分区', async () => {
    const { a, other } = await setup();
    const s = await createSection(db, other.id, '收集');
    const { aliasDrawerTo } = await import('./index');
    const nd = (await aliasDrawerTo(db, a.id, other.id, s.id))!;
    expect(nd).toMatchObject({ workspaceId: other.id, name: 'A' });
    expect((await db.drawers.get(nd.id))!.sectionId).toBe(s.id);
    const data = (await loadWorkspace(db, other.id, visibilityOf(undefined)))!;
    expect(data.drawers.find((d) => d.drawer.id === nd.id)!.mounted.map((i) => i.bookmark.title)).toEqual(['X']);
  });

  it('分区里直接放书签：单独列出，不算顶层；拖进拖出', async () => {
    const { ws, s } = await setup();
    const { placement: p } = await createBookmark(db, { url: 'y.com', title: 'Y' }, ws.id, null, s.id);
    const { placement: t } = await createBookmark(db, { url: 'z.com', title: 'Z' }, ws.id, null);
    let data = (await loadWorkspace(db, ws.id, visibilityOf(undefined)))!;
    expect(data.sectionItems[s.id]!.map((i) => i.bookmark.title)).toEqual(['Y']);
    expect(data.top.map((i) => i.bookmark.title)).toEqual(['Z']);
    await placeInOrder(db, t.id, [p.id, t.id], ws.id, null, s.id);
    data = (await loadWorkspace(db, ws.id, visibilityOf(undefined)))!;
    expect(data.sectionItems[s.id]!.map((i) => i.bookmark.title)).toEqual(['Y', 'Z']);
    expect(data.top).toEqual([]);
    await placeInOrder(db, p.id, [p.id], ws.id, null);
    expect((await db.placements.get(p.id))!.sectionId).toBeUndefined();
  });

  it('分区里的书签：移动跟着走，分身复制，解散回顶层', async () => {
    const { ws, other, s } = await setup();
    const { placement: p } = await createBookmark(db, { url: 'y.com', title: 'Y' }, ws.id, null, s.id);
    await cloneSectionTo(db, ws.id, s.id, other.id);
    const ns = (await db.workspaces.get(other.id))!.sections![0]!;
    expect((await loadWorkspace(db, other.id, visibilityOf(undefined)))!.sectionItems[ns.id]!.map((i) => i.bookmark.title)).toEqual(['Y']);
    await moveSection(db, ws.id, s.id, other.id);
    expect((await db.placements.get(p.id))!.workspaceId).toBe(other.id);
    await dissolveSection(db, other.id, s.id);
    const data = (await loadWorkspace(db, other.id, visibilityOf(undefined)))!;
    expect(data.top.map((i) => i.bookmark.title)).toEqual(['Y', 'Y'].slice(0, data.top.length));
    expect((await db.placements.get(p.id))!.sectionId).toBeUndefined();
  });
});

describe('按住 Option / Alt 拖成关联链接', () => {
  it('被拖书签并进目标的关联链接，去重，原位置删掉', async () => {
    const ws = await createWorkspace(db, { name: '工作' });
    const { bookmark: a } = await createBookmark(db, { url: 'a.com', title: 'A', links: [{ url: 'https://b.com' }] }, ws.id, null);
    const { placement: pb } = await createBookmark(db, { url: 'b.com', title: 'B', links: [{ url: 'https://c.com', title: 'C' }, { url: 'https://a.com' }] }, ws.id, null);
    expect(await mergeAsLink(db, pb.id, a.id)).toBe(true);
    expect((await db.bookmarks.get(a.id))!.links).toEqual([{ url: 'https://b.com' }, { url: 'https://c.com', title: 'C' }]);
    expect(await db.placements.get(pb.id)).toBeUndefined();
  });
});
