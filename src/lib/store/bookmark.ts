import type { Bookmark, NavillDB, Placement } from '@/src/db';
import { del, deviceId, patch, put, tx, uid } from './core';
import { nextOrder, removePlacement } from './placement';
import { logged, q } from '../log';

export function normalizeUrl(url: string): string {
  const u = url.trim();
  if (!u) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return u;
  return `https://${u}`;
}

/** 关联链接：去掉空行、规范 URL；一条都没有时为 undefined */
function cleanLinks(raw: { url: string; title?: string }[]) {
  const links = raw
    .map((l) => ({ url: l.url.trim(), title: l.title?.trim() || undefined }))
    .filter((l) => l.url)
    .map((l) => ({ ...l, url: normalizeUrl(l.url) }));
  return links.length ? links : undefined;
}

export async function createBookmark(
  db: NavillDB,
  input: { url: string; title?: string; note?: string; tagIds?: string[]; faviconUrl?: string; links?: { url: string; title?: string }[] },
  workspaceId: string,
  drawerId: string | null,
) {
  const links = cleanLinks(input.links ?? []);
  return logged(db, async (log) => {
    const url = normalizeUrl(input.url);
    if (!url) throw new Error('URL 不能为空');
    const now = Date.now();
    const b = await put<Bookmark>(db, 'bookmarks', {
      id: uid(), url, title: input.title?.trim() || url, note: input.note || undefined, tagIds: input.tagIds ?? [],
      faviconUrl: input.faviconUrl?.trim() || undefined, links,
      openCount: 0, createdAt: now, updatedAt: 0,
    });
    const p = await put<Placement>(db, 'placements', {
      id: uid(), bookmarkId: b.id, workspaceId, drawerId, order: await nextOrder(db, workspaceId, drawerId),
      isAlias: false, updatedAt: 0,
    });
    log({ kind: 'create', targetType: 'bookmark', targetId: b.id, summary: `新建书签${q(b.title)}` });
    return { bookmark: b, placement: p };
  });
}

export async function updateBookmark(
  db: NavillDB, id: string, changes: Partial<Pick<Bookmark, 'title' | 'url' | 'note' | 'faviconUrl' | 'tagIds' | 'links'>>,
) {
  if (changes.url !== undefined) changes.url = normalizeUrl(changes.url);
  if (changes.links !== undefined) changes.links = cleanLinks(changes.links);
  await logged(db, async (log) => {
    const b = await db.bookmarks.get(id);
    if (!b) return;
    await patch<Bookmark>(db, 'bookmarks', id, changes);
    log({ kind: 'edit', targetType: 'bookmark', targetId: id, summary: `编辑书签${q(changes.title ?? b.title)}` });
  });
}

/** 删除原书签及全部分身 */
export async function deleteBookmarkEverywhere(db: NavillDB, bookmarkId: string) {
  await logged(db, async (log) => {
    const b = await db.bookmarks.get(bookmarkId);
    if (b) log({ kind: 'delete', targetType: 'bookmark', targetId: bookmarkId, summary: `删除书签${q(b.title)}及全部分身` });
    const ps = await db.placements.where('bookmarkId').equals(bookmarkId).toArray();
    for (const p of ps) await del(db, 'placements', p.id);
    await del(db, 'bookmarks', bookmarkId);
  });
}

/** 仅删此处 */
export const deletePlacementOnly = removePlacement;

export async function archiveBookmark(db: NavillDB, id: string, archived = true) {
  await logged(db, async (log) => {
    const b = await db.bookmarks.get(id);
    if (!b) return;
    await patch<Bookmark>(db, 'bookmarks', id, { archivedAt: archived ? Date.now() : undefined });
    log({ kind: archived ? 'archive' : 'restore', targetType: 'bookmark', targetId: id, summary: `${archived ? '归档' : '恢复'}书签${q(b.title)}` });
  });
}

/** 记一次从 Navill 发起的打开 */
export async function recordOpen(db: NavillDB, bookmarkId: string, placementId: string) {
  const dev = await deviceId(db);
  await db.transaction('rw', db.bookmarks, db.openEvents, async () => {
    const now = Date.now();
    await db.openEvents.add({ id: uid(), bookmarkId, placementId, openedAt: now, deviceId: dev });
    const b = await db.bookmarks.get(bookmarkId);
    if (b) await db.bookmarks.update(bookmarkId, { openCount: (b.openCount ?? 0) + 1, lastOpenedAt: now });
  });
}

export async function clearOpenEvents(db: NavillDB) {
  await db.transaction('rw', db.bookmarks, db.openEvents, db.visits, db.meta, async () => {
    await db.openEvents.clear();
    await db.visits.clear();
    // 之后从浏览记录打底时，只统计清除之后的访问
    await db.meta.put({ key: 'countsClearedAt', value: Date.now() });
    await db.meta.delete('historySeededAt');
    await db.bookmarks.toCollection().modify({ openCount: 0, lastOpenedAt: undefined });
  });
}
