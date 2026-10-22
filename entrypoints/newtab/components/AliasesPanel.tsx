import { Button } from '@cloudflare/kumo';
import { Unlink } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db';
import { detachAlias, unmount } from '@/src/lib/store';
import { InfoTip } from '@/src/ui/InfoTip';
import { tr } from '@/src/i18n';

/** 管理分身：分身书签组（整抽屉挂载）与单个分身；从 AppMenu「管理分身」打开，在右侧抽屉中显示 */
export function AliasesPanel() {
  const data = useLiveQuery(async () => {
    const [aliases, groups, drawers, workspaces] = await Promise.all([
      db.placements.filter((p) => p.isAlias).toArray(), db.aliasGroups.toArray(), db.drawers.toArray(), db.workspaces.toArray(),
    ]);
    const bookmarks = new Map((await db.bookmarks.bulkGet([...new Set(aliases.map((a) => a.bookmarkId))])).filter(Boolean).map((b) => [b!.id, b!]));
    const dr = new Map(drawers.map((d) => [d.id, d]));
    const ws = new Map(workspaces.map((w) => [w.id, w]));
    const where = (wid: string, did: string | null) => `${ws.get(wid)?.name ?? '?'}${did ? ` / ${dr.get(did)?.name ?? '?'}` : ''}`;
    return {
      aliases: aliases.map((a) => ({ a, b: bookmarks.get(a.bookmarkId), where: where(a.workspaceId, a.drawerId) })),
      groups: groups.map((g) => {
        const s = dr.get(g.sourceDrawerId);
        const t = dr.get(g.targetDrawerId);
        return { g, from: s ? where(s.workspaceId, s.id) : '?', to: t ? where(t.workspaceId, t.id) : '?' };
      }),
    };
  }, []);
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold">{tr('分身书签组')}<span className="font-normal text-kumo-subtle">{data?.groups.length ?? 0}</span><InfoTip>{tr('在抽屉 ⋯ 菜单里选「创建分身」，把整个抽屉挂载到另一个抽屉。')}</InfoTip></h3>
        {data?.groups.map(({ g, from, to }) => (
          <div key={g.id} className="flex items-center gap-2 border-b border-kumo-line py-2 text-sm">
            <span className="flex-1">{from} <span className="text-kumo-subtle">{tr('→ 挂载到 →')}</span> {to}</span>
            <Button size="xs" icon={<Unlink size="1em" />} onClick={() => void unmount(db, g.id)}>{tr('解除挂载')}</Button>
          </div>
        ))}
      </section>
      <section>
        <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold">{tr('分身')}<span className="font-normal text-kumo-subtle">{data?.aliases.length ?? 0}</span></h3>
        {data?.aliases.map(({ a, b, where }) => (
          <div key={a.id} className="flex items-center gap-2 border-b border-kumo-line py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{b?.title}</span>
            <span className="text-xs text-kumo-subtle">{where}</span>
            <Button size="xs" icon={<Unlink size="1em" />} onClick={() => void detachAlias(db, a.id)}>{tr('转为独立书签')}</Button>
          </div>
        ))}
      </section>
    </div>
  );
}
