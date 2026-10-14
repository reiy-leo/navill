import { Button, Empty } from '@cloudflare/kumo';
import { Archive, ArrowCounterClockwise } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db';
import { archiveBookmark } from '@/src/lib/store';
import type { Item } from '@/src/lib/view';
import { bookmarkMenu } from '@/src/ui/actions';
import { useContextMenu } from '@/src/ui/ContextMenu';
import { useDialogs } from '@/src/ui/dialogs';
import { BookmarkIcon, hostOf } from '@/src/ui/icons';
import { useApp } from '@/src/ui/state';

/** 归档视图：归档的书签（含其分身）在各工作区隐藏，集中在这里，可恢复或彻底删除 */
export function ArchiveView() {
  const { settings } = useApp();
  const menu = useContextMenu();
  const dialogs = useDialogs();
  const items = useLiveQuery(async () => {
    const list = (await db.bookmarks.toArray()).filter((b) => b.archivedAt).sort((a, b) => b.archivedAt! - a.archivedAt!);
    const out: Item[] = [];
    for (const b of list) {
      const ps = await db.placements.where('bookmarkId').equals(b.id).toArray();
      const p = ps.find((x) => !x.isAlias) ?? ps[0];
      if (p) out.push({ bookmark: b, placement: p });
    }
    return out;
  }, []);
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">归档</h1>
      {items?.length === 0 ? (
        <Empty icon={<Archive size={40} />} title="归档是空的" description="在书签右键菜单中选择「归档」，它和它的分身会从工作区里隐藏，集中放在这里。" />
      ) : (
        <ul className="flex flex-col">
          {items?.map((it) => (
            <li key={it.bookmark.id} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-kumo-tint" onContextMenu={(e) => menu(e, bookmarkMenu(it, dialogs, settings))}>
              <BookmarkIcon url={it.bookmark.url} size={20} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{it.bookmark.title}</div>
                <div className="truncate text-xs text-kumo-subtle">{hostOf(it.bookmark.url)} · 归档于 {new Date(it.bookmark.archivedAt!).toLocaleDateString('zh-CN')}</div>
              </div>
              <Button size="sm" icon={<ArrowCounterClockwise />} onClick={() => void archiveBookmark(db, it.bookmark.id, false)}>恢复</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
