import { Button, Empty } from '@cloudflare/kumo';
import { Archive, ArrowCounterClockwise, Trash, Tray } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db';
import { archiveBookmark, archiveDrawer, deleteDrawer } from '@/src/lib/store';
import type { Item } from '@/src/lib/view';
import { bookmarkMenu } from '@/src/ui/actions';
import { useContextMenu } from '@/src/ui/ContextMenu';
import { useDialogs } from '@/src/ui/dialogs';
import { BookmarkIcon, hostOf } from '@/src/ui/icons';
import { useApp } from '@/src/ui/state';

/** 归档视图：归档的抽屉和书签（含其分身）在各工作区隐藏，集中在这里，可恢复或彻底删除 */
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
  const drawers = useLiveQuery(async () => {
    const list = (await db.drawers.toArray()).filter((d) => d.archivedAt).sort((a, b) => b.archivedAt! - a.archivedAt!);
    return Promise.all(list.map(async (d) => ({
      drawer: d,
      workspace: (await db.workspaces.get(d.workspaceId))?.name ?? '',
      count: await db.placements.where('drawerId').equals(d.id).count(),
    })));
  }, []);
  const empty = items?.length === 0 && drawers?.length === 0;
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">归档</h1>
      {empty && (
        <Empty icon={<Archive size={40} />} title="归档是空的" description="在书签右键菜单或抽屉的 ⋯ 菜单中选择「归档」，它会从工作区里隐藏，集中放在这里。" />
      )}
      {!!drawers?.length && (
        <section className="flex flex-col gap-1">
          <h2 className="px-3 text-sm font-medium text-kumo-subtle">抽屉</h2>
          <ul className="flex flex-col">
            {drawers.map(({ drawer: d, workspace, count }) => (
              <li key={d.id} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-kumo-tint">
                <Tray size={20} className="text-kumo-subtle" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{d.name}</div>
                  <div className="truncate text-xs text-kumo-subtle">{workspace} · {count} 个书签 · 归档于 {new Date(d.archivedAt!).toLocaleDateString('zh-CN')}</div>
                </div>
                <Button size="sm" icon={<ArrowCounterClockwise />} onClick={() => void archiveDrawer(db, d.id, false)}>恢复</Button>
                <Button size="sm" variant="ghost" shape="square" icon={<Trash />} aria-label="删除抽屉" onClick={async () => {
                  if (await dialogs.confirm({ title: `删除「${d.name}」？`, description: `抽屉连同其中 ${count} 个书签一起删除。原书签有分身时，由分身接任。`, okText: '删除', danger: true })) await deleteDrawer(db, d.id);
                }} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {!!items?.length && (
        <section className="flex flex-col gap-1">
        {!!drawers?.length && <h2 className="px-3 text-sm font-medium text-kumo-subtle">书签</h2>}
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
        </section>
      )}
    </div>
  );
}
