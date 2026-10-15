import { Button, Empty, Loader } from '@cloudflare/kumo';
import { ArrowRight, Star } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { TAG_FAVORITE, db } from '@/src/db';
import { listPublicShares, type PublicShare } from '@/src/lib/share';
import { mostOpened, search, visibilityOf } from '@/src/lib/view';
import { useApp } from '@/src/ui/state';
import { Items } from './Items';

/** 市场最新分享在主页最多显示几个 */
const LATEST = 6;

/** 主页：#收藏 标签的书签、最常用的书签（图标一行），然后是市场里最新的分享（倒序，最多 6 个） */
export function HomeView() {
  const { mode, setView } = useApp();
  const favs = useLiveQuery(async () => {
    const hits = await search(db, '#收藏', visibilityOf(mode), 500);
    return hits.map((h) => h.item).filter((it) => it.bookmark.tagIds.includes(TAG_FAVORITE));
  }, [mode]);
  const top = useLiveQuery(() => mostOpened(db, visibilityOf(mode), 20), [mode]);
  const [latest, setLatest] = useState<PublicShare[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    listPublicShares(null).then(
      (r) => setLatest([...r.items].sort((a, b) => b.publishedAt - a.publishedAt).slice(0, LATEST)),
      (e) => { setLatest([]); setErr(e instanceof Error ? e.message : String(e)); },
    );
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">收藏</h2>
        {!favs ? <div className="flex justify-center py-6"><Loader /></div> : favs.length === 0 ? (
          <Empty icon={<Star size={36} />} title="还没有收藏" description="给书签加上「收藏」标签，就会出现在这里。" />
        ) : (
          <Items items={favs} view="icon" />
        )}
      </section>

      {!!top?.length && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-medium">最常用</h2>
          <Items items={top} view="icon" strip />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">市场最新分享</h2>
          <Button size="sm" variant="ghost" onClick={() => setView('market')}>查看更多<ArrowRight size={14} /></Button>
        </div>
        {err && <p className="text-sm text-kumo-danger">{err}</p>}
        {latest === null && <div className="flex justify-center py-6"><Loader /></div>}
        {latest?.length === 0 && !err && <p className="text-sm text-kumo-subtle">市场里还没有分享。</p>}
        {!!latest?.length && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {latest.map((s) => (
              <button key={s.id} type="button" onClick={() => setView('market')}
                className="nv-drawer flex flex-col items-start gap-1 rounded-xl p-3 text-left transition hover:-translate-y-0.5"
                style={s.color ? ({ '--ws-color': s.color } as React.CSSProperties) : undefined}>
                <div className="flex w-full items-center gap-1.5 text-sm font-medium">
                  {s.emoji && <span>{s.emoji}</span>}
                  <span className="truncate">{s.title}</span>
                </div>
                <div className="w-full truncate text-xs text-kumo-subtle">{s.author} · {s.kind === 'drawer' ? '抽屉' : `工作区 · ${s.drawerCount} 个抽屉`} · {s.bookmarkCount} 个书签</div>
                {s.description && <p className="line-clamp-2 text-xs text-kumo-subtle">{s.description}</p>}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
