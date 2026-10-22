import { Button } from '@cloudflare/kumo';
import { ArrowsOutCardinal, Copy, Tag, Trash, X, Archive } from '@phosphor-icons/react';
import { db } from '@/src/db';
import { archiveBookmark, removePlacement } from '@/src/lib/store';
import { aliasTo, moveTo } from '@/src/ui/actions';
import { useDialogs } from '@/src/ui/dialogs';
import { useSelection } from '@/src/ui/state';

import { tr } from '@/src/i18n';
/** 「整理」多选模式的底部操作栏 */
export function OrganizeBar() {
  const { organize, selection, clearSelection, setOrganize } = useSelection();
  const dialogs = useDialogs();
  if (!organize) return null;
  const ids = [...selection];
  const bookmarkIds = async () => [...new Set((await db.placements.bulkGet(ids)).filter(Boolean).map((p) => p!.bookmarkId))];
  const n = ids.length;
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-kumo-line bg-kumo-elevated px-3 py-2 shadow-lg">
      <span className="px-2 text-sm">{n ? tr('已选 {0} 个', n) : tr('点击书签进行选择')}</span>
      <Button size="sm" icon={<ArrowsOutCardinal />} disabled={!n} onClick={async () => { await moveTo(dialogs, ids); clearSelection(); }}>{tr('移动到…')}</Button>
      <Button size="sm" icon={<Copy />} disabled={!n} onClick={async () => { await aliasTo(dialogs, await bookmarkIds()); clearSelection(); }}>{tr('创建分身到…')}</Button>
      <Button size="sm" icon={<Tag />} disabled={!n} onClick={async () => dialogs.editTags(await bookmarkIds())}>{tr('标签…')}</Button>
      <Button size="sm" icon={<Archive />} disabled={!n} onClick={async () => { for (const id of await bookmarkIds()) await archiveBookmark(db, id); clearSelection(); }}>{tr('归档')}</Button>
      <Button size="sm" variant="secondary-destructive" icon={<Trash />} disabled={!n} onClick={async () => {
        if (await dialogs.confirm({ title: tr('删除选中的 {0} 处书签？', n), description: tr('只删除选中的位置；原书签若有分身，由分身接任。'), okText: tr('删除'), danger: true })) {
          for (const id of ids) await removePlacement(db, id);
          clearSelection();
        }
      }}>{tr('删除')}</Button>
      <Button size="sm" variant="ghost" shape="square" icon={<X />} aria-label={tr('退出整理')} onClick={() => setOrganize(false)} />
    </div>
  );
}
