import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDB, type NavillDB } from '@/src/db';
import { createBookmark, createWorkspace, ensureSeed, updateBookmark } from '../store';
import type { Backend, RemoteFile } from './backend';

/** 内存里的同步目标；onUpload 用来模拟「上传途中本机又改了东西」 */
const files = new Map<string, { file: RemoteFile; body: ArrayBuffer }>();
let onUpload: ((name: string) => Promise<void>) | null = null;
let seq = 0;
const mem: Backend = {
  listFiles: async () => [...files.values()].map((f) => f.file),
  download: async (f) => files.get(f.name)!.body,
  upload: async (name, body) => {
    if (onUpload) await onUpload(name);
    const file = { id: name, name, modifiedTime: String(++seq) };
    files.set(name, { file, body: await body.arrayBuffer() });
    return file;
  },
  remove: async (f) => { files.delete(f.name); },
};
vi.mock('./backend', async (orig) => ({
  ...(await orig<typeof import('./backend')>()),
  backend: async () => mem,
  isConnected: async () => true,
}));
const { syncNow } = await import('./engine');

let db: NavillDB;
let n = 0;
beforeEach(async () => {
  files.clear();
  onUpload = null;
  db = createDB(`engine-${n++}`);
  await ensureSeed(db);
});

describe('同步途中的本机改动', () => {
  it('不会被清出 outbox，也不会被合并结果盖掉', async () => {
    const ws = await createWorkspace(db, { name: '工作' });
    const { bookmark } = await createBookmark(db, { url: 'https://x.com', title: '旧标题' }, ws.id, null);
    onUpload = async (name) => {
      if (name !== 'state.json.gz') return;
      onUpload = null;
      await new Promise((r) => setTimeout(r, 2));
      await updateBookmark(db, bookmark.id, { title: '新标题' });
    };
    await syncNow(db);
    expect((await db.bookmarks.get(bookmark.id))?.title).toBe('新标题');
    expect(await db.outbox.get(`bookmarks:${bookmark.id}`)).toBeTruthy();

    // 下一轮把它传上去，outbox 清空
    await syncNow(db);
    expect(await db.outbox.count()).toBe(0);
  });

  it('没有途中改动时，一轮同步后 outbox 为空', async () => {
    const ws = await createWorkspace(db, { name: '工作' });
    await createBookmark(db, { url: 'https://y.com', title: 'Y' }, ws.id, null);
    await syncNow(db);
    expect(await db.outbox.count()).toBe(0);
  });
});
