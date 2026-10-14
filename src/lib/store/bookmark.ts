import type { Bookmark, NavillDB, Placement } from '@/src/db';
import { del, deviceId, patch, put, tx, uid } from './core';
import { nextOrder, removePlacement } from './placement';

export function normalizeUrl(url: string): string {
  const u = url.trim();
  if (!u) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return u;
  return `https://${u}`;
}

export async function createBookmark(
  db: NavillDB,
  input: { url: string; title?: string; note?: string; tagIds?: string[] },
  workspaceId: string,
  drawerId: string | null,
) {
  return tx(db, async () => {
    const url = normalizeUrl(input.url);
    if (!url) throw new Error('URL 不能为空');
    const now = Date.now();
    const b = await put<Bookmark>(db, 'bookmarks', {
      id: uid(), url, title: input.title?.trim() || url, note: input.note, tagIds: input.tagIds ?? [],
      openCount: 0, createdAt: now, updatedAt: 0,
    });
    const p = await put<Placement>(db, 'placements', {
      id: uid(), bookmarkId: b.id, workspaceId, drawerId, order: await nextOrder(db, workspaceId, drawerId),
      isAlias: false, updatedAt: 0,
    });
    return { bookmark: b, placement: p };
  });
}

export async function updateBookmark(
  db: NavillDB, id: string, changes: Partial<Pick<Bookmark, 'title' | 'url' | 'note' | 'faviconUrl' | 'tagIds' | 'links'>>,
) {
  if (changes.url !== undefined) changes.url = normalizeUrl(changes.url);
  if (changes.links !== undefined) {
    const links = changes.links
      .map((l) => ({ url: l.url.trim(), title: l.title?.trim() || undefined }))
      .filter((l) => l.url)
      .map((l) => ({ ...l, url: normalizeUrl(l.url) }));
    changes.links = links.length ? links : undefined;
  }
  await patch<Bookmark>(db, 'bookmarks', id, changes);
}

/** 删除原书签及全部分身 */
export async function deleteBookmarkEverywhere(db: NavillDB, bookmarkId: string) {
  await tx(db, async () => {
    const ps = await db.placements.where('bookmarkId').equals(bookmarkId).toArray();
    for (const p of ps) await del(db, 'placements', p.id);
    await del(db, 'bookmarks', bookmarkId);
  });
}

/** 仅删此处 */
export const deletePlacementOnly = removePlacement;

export async function archiveBookmark(db: NavillDB, id: string, archived = true) {
  await patch<Bookmark>(db, 'bookmarks', id, { archivedAt: archived ? Date.now() : undefined });
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
  await db.transaction('rw', db.bookmarks, db.openEvents, async () => {
    await db.openEvents.clear();
    await db.bookmarks.toCollection().modify({ openCount: 0, lastOpenedAt: undefined });
  });
}
