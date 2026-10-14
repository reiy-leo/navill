import type { Bookmark, NavillDB, Tag } from '@/src/db';
import { del, patch, put, tx, uid } from './core';

export async function createTag(db: NavillDB, name: string) {
  const n = name.trim().replace(/^#/, '');
  if (!n) throw new Error('标签名不能为空');
  const all = await db.tags.toArray();
  const dup = all.find((t) => t.name === n);
  if (dup) return dup;
  return put<Tag>(db, 'tags', {
    id: uid(), name: n, builtin: null, order: all.reduce((m, x) => Math.max(m, x.order), -1) + 1,
    createdAt: Date.now(), updatedAt: 0,
  });
}

export async function renameTag(db: NavillDB, id: string, name: string) {
  const t = await db.tags.get(id);
  const n = name.trim().replace(/^#/, '');
  if (!t || t.builtin || !n) return;
  await patch<Tag>(db, 'tags', id, { name: n });
}

/** 删除自定义标签，并从所有书签上移除 */
export async function deleteTag(db: NavillDB, id: string) {
  await tx(db, async () => {
    const t = await db.tags.get(id);
    if (!t || t.builtin) return;
    const tagged = await db.bookmarks.where('tagIds').equals(id).toArray();
    for (const b of tagged) await patch<Bookmark>(db, 'bookmarks', b.id, { tagIds: b.tagIds.filter((x) => x !== id) });
    await del(db, 'tags', id);
  });
}

export async function setTags(db: NavillDB, bookmarkId: string, tagIds: string[]) {
  await patch<Bookmark>(db, 'bookmarks', bookmarkId, { tagIds: [...new Set(tagIds)] });
}

/** 批量加 / 去标签 */
export async function toggleTagOn(db: NavillDB, bookmarkIds: string[], tagId: string, on: boolean) {
  await tx(db, async () => {
    for (const id of bookmarkIds) {
      const b = await db.bookmarks.get(id);
      if (!b) continue;
      const set = new Set(b.tagIds);
      if (on) set.add(tagId);
      else set.delete(tagId);
      await patch<Bookmark>(db, 'bookmarks', id, { tagIds: [...set] });
    }
  });
}
