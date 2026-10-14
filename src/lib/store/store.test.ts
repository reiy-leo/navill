import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { MODE_DEFAULT, TAG_ADULT, TAG_TODO, createDB, type NavillDB } from '@/src/db';
import { loadWorkspace, search, visibilityOf } from '../view';
import {
  createAlias, createBookmark, createDrawer, createMode, createTag, createWorkspace, deleteDrawer, deleteTag,
  deleteWorkspace, dissolveDrawer, ensureSeed, mountDrawer, movePlacement, recordOpen, removePlacement,
  setShowAdult, setTags, updateBookmark, setVisible, shuffleDrawer, updateDrawer, updateWorkspace, wouldCycle, AliasCycleError, parseWorkspaceIcons,
} from './index';

let db: NavillDB;
let n = 0;
beforeEach(async () => {
  db = createDB(`store-${n++}`);
  await ensureSeed(db);
});

async function setup() {
  const ws = await createWorkspace(db, { name: '工作' });
  const a = await createDrawer(db, ws.id, 'A');
  const b = await createDrawer(db, ws.id, 'B');
  const x = await createBookmark(db, { url: 'x.com', title: 'X' }, ws.id, a.id);
  const y = await createBookmark(db, { url: 'https://y.com', title: 'Y' }, ws.id, a.id);
  return { ws, a, b, x, y };
}

describe('种子数据', () => {
  it('预设五个场景、三个内置标签、一个「待整理」，重复调用不重复创建', async () => {
    await ensureSeed(db);
    expect((await db.modes.orderBy('order').toArray()).map((m) => m.name)).toEqual(['默认', '工作', '居家', '演讲', '借用']);
    expect((await db.tags.orderBy('order').toArray()).map((t) => t.name)).toEqual(['18+', '收藏', '待办']);
    expect(await db.workspaces.where('source').equals('inbox').count()).toBe(1);
  });
});

describe('书签与分身', () => {
  it('补全 https://', async () => {
    const { x } = await setup();
    expect(x.bookmark.url).toBe('https://x.com');
  });

  it('删除原书签位置时最早的分身接任；删最后一个位置时书签一并删除', async () => {
    const { ws, b, x } = await setup();
    const aliasId = (await createAlias(db, x.bookmark.id, ws.id, b.id))!;
    expect(await createAlias(db, x.bookmark.id, ws.id, b.id)).toBeNull();
    await removePlacement(db, x.placement.id);
    expect((await db.placements.get(aliasId))!.isAlias).toBe(false);
    await removePlacement(db, aliasId);
    expect(await db.bookmarks.get(x.bookmark.id)).toBeUndefined();
  });

  it('移动到指定位置并重排', async () => {
    const { ws, a, b, x, y } = await setup();
    await movePlacement(db, y.placement.id, ws.id, b.id);
    await movePlacement(db, x.placement.id, ws.id, b.id, 0);
    const list = await db.placements.where('drawerId').equals(b.id).sortBy('order');
    expect(list.map((p) => p.bookmarkId)).toEqual([x.bookmark.id, y.bookmark.id]);
    expect(await db.placements.where('drawerId').equals(a.id).count()).toBe(0);
  });

  it('打开计数与时间戳；分身与原书签合并计数', async () => {
    const { ws, b, x } = await setup();
    const aliasId = (await createAlias(db, x.bookmark.id, ws.id, b.id))!;
    await recordOpen(db, x.bookmark.id, x.placement.id);
    await recordOpen(db, x.bookmark.id, aliasId);
    expect((await db.bookmarks.get(x.bookmark.id))!.openCount).toBe(2);
    expect((await db.openEvents.where('bookmarkId').equals(x.bookmark.id).toArray()).map((e) => e.placementId).sort()).toEqual(
      [x.placement.id, aliasId].sort(),
    );
  });
});

describe('抽屉', () => {
  it('解散：书签移到工作区顶层，抽屉删除', async () => {
    const { ws, a } = await setup();
    await dissolveDrawer(db, a.id);
    expect(await db.drawers.get(a.id)).toBeUndefined();
    const top = (await db.placements.where('workspaceId').equals(ws.id).toArray()).filter((p) => p.drawerId === null);
    expect(top).toHaveLength(2);
  });

  it('删除：连同书签删除', async () => {
    const { a } = await setup();
    await deleteDrawer(db, a.id);
    expect(await db.bookmarks.count()).toBe(0);
  });

  it('打乱后排序切回手动', async () => {
    const { ws, a } = await setup();
    await updateDrawer(db, a.id, { sortMode: 'name-desc' });
    await shuffleDrawer(db, ws.id, a.id, () => 0);
    expect((await db.drawers.get(a.id))!.sortMode).toBe('manual');
  });

  it('分身书签组：目标抽屉展开源抽屉书签，实时反映；防循环', async () => {
    const { ws, a, b } = await setup();
    await mountDrawer(db, a.id, b.id);
    await expect(mountDrawer(db, b.id, a.id)).rejects.toBeInstanceOf(AliasCycleError);
    await createBookmark(db, { url: 'z.com', title: 'Z' }, ws.id, a.id);
    const data = (await loadWorkspace(db, ws.id, visibilityOf(undefined)))!;
    const B = data.drawers.find((d) => d.drawer.id === b.id)!;
    expect(B.mounted.map((i) => i.bookmark.title)).toEqual(['X', 'Y', 'Z']);
  });

  it('循环检测覆盖长链', () => {
    const g = [
      { sourceDrawerId: 'a', targetDrawerId: 'b' },
      { sourceDrawerId: 'b', targetDrawerId: 'c' },
    ];
    expect(wouldCycle(g, 'c', 'a')).toBe(true);
    expect(wouldCycle(g, 'a', 'c')).toBe(false);
    expect(wouldCycle(g, 'x', 'x')).toBe(true);
  });
});

describe('工作区', () => {
  it('「待整理」不可改名、不可删除；说明截到 50 字', async () => {
    const inbox = (await db.workspaces.where('source').equals('inbox').first())!;
    await updateWorkspace(db, inbox.id, { name: '改', description: 'x'.repeat(80) });
    const after = (await db.workspaces.get(inbox.id))!;
    expect(after.name).toBe('待整理');
    expect(after.description).toHaveLength(50);
    await deleteWorkspace(db, inbox.id);
    expect(await db.workspaces.get(inbox.id)).toBeTruthy();
  });

  it('仅当前场景可见：在其他非默认场景隐藏', async () => {
    const ws = await createWorkspace(db, { name: '演讲稿' }, 'mode-talk');
    const work = (await db.modes.get('mode-work'))!;
    expect(work.hiddenWorkspaceIds).toContain(ws.id);
    expect((await db.modes.get('mode-talk'))!.hiddenWorkspaceIds).not.toContain(ws.id);
  });
});

describe('场景与标签', () => {
  it('场景隐藏抽屉；18+ 开关控制 18+ 标签书签与 18+ 抽屉', async () => {
    const { ws, a, b, x } = await setup();
    await setTags(db, x.bookmark.id, [TAG_ADULT, TAG_ADULT, TAG_TODO]);
    expect((await db.bookmarks.get(x.bookmark.id))!.tagIds).toEqual([TAG_ADULT, TAG_TODO]);
    await updateDrawer(db, b.id, { adult: true });
    await setVisible(db, 'mode-work', 'drawer', a.id, false);

    const work = await loadWorkspace(db, ws.id, visibilityOf(await db.modes.get('mode-work')));
    expect(work!.drawers).toHaveLength(0);

    const def = await loadWorkspace(db, ws.id, visibilityOf(await db.modes.get(MODE_DEFAULT)));
    expect(def!.drawers.map((d) => d.drawer.name)).toEqual(['A']);
    expect(def!.drawers[0]!.items.map((i) => i.bookmark.title)).toEqual(['Y']);

    await setShowAdult(db, MODE_DEFAULT, true);
    const adult = await loadWorkspace(db, ws.id, visibilityOf(await db.modes.get(MODE_DEFAULT)));
    expect(adult!.drawers.map((d) => d.drawer.name)).toEqual(['A', 'B']);
  });

  it('「默认」场景可见性不可编辑', async () => {
    const { a } = await setup();
    await setVisible(db, MODE_DEFAULT, 'drawer', a.id, false);
    expect((await db.modes.get(MODE_DEFAULT))!.hiddenDrawerIds).toEqual([]);
  });

  it('删除自定义标签时从书签上移除；内置标签不可删', async () => {
    const { x } = await setup();
    const t = await createTag(db, '#阅读');
    expect(t.name).toBe('阅读');
    await setTags(db, x.bookmark.id, [t.id, TAG_TODO]);
    await deleteTag(db, t.id);
    await deleteTag(db, TAG_TODO);
    expect((await db.bookmarks.get(x.bookmark.id))!.tagIds).toEqual([TAG_TODO]);
    expect(await db.tags.get(TAG_TODO)).toBeTruthy();
  });

  it('新增场景', async () => {
    const m = await createMode(db, '旅行');
    expect(m.builtin).toBeNull();
  });
});

describe('搜索', () => {
  it('标题 / URL / 备注 + #标签，遵守场景可见性', async () => {
    const { ws, a, x } = await setup();
    await setTags(db, x.bookmark.id, [TAG_TODO]);
    const v = visibilityOf(await db.modes.get(MODE_DEFAULT));
    expect((await search(db, 'y.com', v)).map((h) => h.item.bookmark.title)).toEqual(['Y']);
    expect((await search(db, '#待办', v)).map((h) => h.item.bookmark.title)).toEqual(['X']);
    expect(await search(db, '#不存在', v)).toEqual([]);
    await setVisible(db, 'mode-work', 'drawer', a.id, false);
    expect(await search(db, 'x', visibilityOf(await db.modes.get('mode-work')))).toEqual([]);
    expect(ws).toBeTruthy();
  });
});

describe('关联链接', () => {
  it('保存时去掉空行并规范 URL，搜索能命中关联链接', async () => {
    const { x } = await setup();
    await updateBookmark(db, x.bookmark.id, { links: [{ url: 'github.com/x/x', title: ' 源码 ' }, { url: '  ' }] });
    expect((await db.bookmarks.get(x.bookmark.id))!.links).toEqual([{ url: 'https://github.com/x/x', title: '源码' }]);
    const v = visibilityOf(await db.modes.get(MODE_DEFAULT));
    expect((await search(db, 'github', v)).map((h) => h.item.bookmark.title)).toEqual(['X']);
    await updateBookmark(db, x.bookmark.id, { links: [] });
    expect((await db.bookmarks.get(x.bookmark.id))!.links).toBeUndefined();
  });
});

describe('工作区名称 emoji', () => {
  it('新建与改名时 emoji 移到图标，名称不保留', async () => {
    const ws = await createWorkspace(db, { name: '🎮 游戏' });
    expect(ws).toMatchObject({ name: '游戏', emoji: '🎮' });
    await updateWorkspace(db, ws.id, { name: '🕹️ 街机' });
    expect(await db.workspaces.get(ws.id)).toMatchObject({ name: '街机', emoji: '🕹️' });
    await updateWorkspace(db, ws.id, { name: '街机厅' });
    expect(await db.workspaces.get(ws.id)).toMatchObject({ name: '街机厅', emoji: '🕹️' });
  });
  it('从名称解析图标：名称里的 emoji（最多两个）覆盖原图标', async () => {
    const a = await db.workspaces.add({ ...(await createWorkspace(db, { name: 'tmp' })), id: 'raw1', name: '📚 学习' });
    const b = await db.workspaces.add({ ...(await createWorkspace(db, { name: 'tmp2' })), id: 'raw2', name: '💼工作📎📌', emoji: '⭐' });
    expect(await parseWorkspaceIcons(db)).toBe(2);
    expect(await db.workspaces.get(a)).toMatchObject({ name: '学习', emoji: '📚' });
    expect(await db.workspaces.get(b)).toMatchObject({ name: '工作', emoji: '💼📎' });
    expect(await parseWorkspaceIcons(db)).toBe(0);
  });
});
