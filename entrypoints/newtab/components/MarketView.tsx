import { Badge, Banner, Button, DropdownMenu, Empty, Loader } from '@cloudflare/kumo';
import { ArrowSquareOut, DotsThree, DownloadSimple, Storefront } from '@phosphor-icons/react';
import { db } from '@/src/db';
import { useDialogs } from '@/src/ui/dialogs';
import { toast } from '@/src/ui/toast';
import { useEffect, useState } from 'react';
import { getPublicShare, installSharedDrawer, listPublicShares, listShares, shareUrl, type PublicShare, type PublicShareDetail } from '@/src/lib/share';
import { BookmarkIcon } from '@/src/ui/icons';

/** 查看市场：所有审核通过的分享（包括自己的），看板展示，每个分享一列 */
export function MarketView() {
  const [items, setItems] = useState<PublicShare[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async (from: string | null) => {
    setBusy(true); setErr('');
    try {
      const r = await listPublicShares(from);
      setItems((l) => [...(from ? l ?? [] : []), ...r.items]);
      setCursor(r.nextCursor);
    } catch (e) {
      setItems((l) => l ?? []);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load(null);
    // 已登录时标出自己的分享；未登录就不标，不弹登录
    listShares(false).then((l) => setMine(new Set(l.map((s) => s.id))), () => {});
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-base font-medium">市场</h1>
      {err && <Banner variant="error" description={err} />}
      {items === null && <div className="flex justify-center py-10"><Loader /></div>}
      {items?.length === 0 && !err && <Empty icon={<Storefront size={40} />} title="市场里还没有分享" description="审核通过的分享会出现在这里。" />}
      {!!items?.length && (
        <div className="-mx-6 flex items-start gap-4 overflow-x-auto px-6 pb-3 [scrollbar-width:thin]">
          {items.map((s) => <ShareColumn key={s.id} share={s} mine={mine.has(s.id)} />)}
          {cursor && (
            <Button className="shrink-0 self-center" loading={busy} onClick={() => void load(cursor)}>加载更多</Button>
          )}
        </div>
      )}
    </div>
  );
}

function ShareColumn({ share, mine }: { share: PublicShare; mine: boolean }) {
  const [detail, setDetail] = useState<PublicShareDetail | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { getPublicShare(share.id).then(setDetail, (e) => setErr(e instanceof Error ? e.message : String(e))); }, [share.id]);
  const p = detail?.payload;
  const dialogs = useDialogs();
  const install = async (d: { name: string; bookmarks: PublicShareDetail['payload']['drawers'][number]['bookmarks'] }) => {
    const t = await dialogs.pickTarget({ title: '安装抽屉', workspacesOnly: true, name: d.name, okText: '安装' });
    if (!t) return;
    const name = t.name || d.name;
    try {
      await installSharedDrawer(db, t.workspaceId, { ...d, name: name || d.name });
      toast(`已安装「${name || d.name}」，共 ${d.bookmarks.length} 个书签`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  };
  const groups = p ? [...(p.loose?.length ? [{ name: '', bookmarks: p.loose }] : []), ...p.drawers] : [];

  return (
    <section className="nv-drawer flex max-h-[calc(100vh-9rem)] w-[300px] shrink-0 flex-col overflow-hidden rounded-xl bg-kumo-elevated/75 ring ring-kumo-line backdrop-blur-sm"
      style={share.color ? ({ '--ws-color': share.color } as React.CSSProperties) : undefined}>
      <header className="flex items-start gap-2 px-3 pb-2 pt-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            {share.emoji && <span>{share.emoji}</span>}
            <span className="truncate">{share.title}</span>
            {mine && <Badge variant="primary">我的</Badge>}
          </div>
          <div className="truncate text-xs text-kumo-subtle">{share.author} · {share.kind === 'drawer' ? '抽屉' : `工作区 · ${share.drawerCount} 个抽屉`} · {share.bookmarkCount} 个书签</div>
          {share.description && <p className="mt-1 line-clamp-2 text-xs text-kumo-subtle">{share.description}</p>}
        </div>
        <Button size="xs" variant="ghost" shape="square" icon={<ArrowSquareOut />} aria-label="打开分享页" onClick={() => void browser.tabs.create({ url: shareUrl(share.id) })} />
      </header>
      <div className="nv-drawer-primary mx-1.5 mb-1.5 min-h-0 flex-1 overflow-y-auto rounded-lg p-1.5 [scrollbar-width:thin]">
        {err && <p className="p-2 text-xs text-kumo-danger">{err}</p>}
        {!p && !err && <div className="flex justify-center py-4"><Loader size="sm" /></div>}
        {groups.map((g, i) => (
          <div key={i} className="group/md mb-1.5 rounded-lg last:mb-0">
            <div className="flex items-center gap-1 pl-2">
              <span className="min-w-0 flex-1 truncate text-xs text-kumo-subtle">{g.name || share.title}</span>
              <DropdownMenu>
                <DropdownMenu.Trigger render={<Button variant="ghost" size="xs" shape="square" icon={<DotsThree weight="bold" />} aria-label="更多" />} />
                <DropdownMenu.Content>
                  <DropdownMenu.Item icon={DownloadSimple} onClick={() => void install({ name: g.name || share.title, bookmarks: g.bookmarks })}>安装到…</DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
            </div>
            {g.bookmarks.map((b, j) => (
              <a key={j} href={b.url} title={b.note ? `${b.title}\n${b.note}` : b.title}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-kumo-default no-underline hover:bg-kumo-tint">
                <BookmarkIcon url={b.url} size={16} />
                <span className="min-w-0 flex-1 truncate">{b.title}</span>
              </a>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
