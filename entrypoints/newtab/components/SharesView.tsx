import { Badge, Banner, Button, Empty, Loader } from '@cloudflare/kumo';
import { ArrowSquareOut, Copy, GoogleLogo, ShareNetwork, SquaresFour, Trash, Tray } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { STATUS_LABEL, deleteShare, listShares, type MyShare } from '@/src/lib/share';
import { useDialogs } from '@/src/ui/dialogs';
import { StatusBadge, copyLink } from '@/src/ui/ShareDialog';
import { toast } from '@/src/ui/toast';

import { dateLocale, tr } from '@/src/i18n';
/** 管理分享：列出已分享的抽屉和工作区，可复制链接、打开、取消分享 */
export function SharesView() {
  const dialogs = useDialogs();
  const [shares, setShares] = useState<MyShare[] | null>(null);
  const [err, setErr] = useState('');
  const [needLogin, setNeedLogin] = useState(false);
  const load = (interactive: boolean) => {
    setErr('');
    return listShares(interactive).then((l) => { setShares(l); setNeedLogin(false); }, (e) => {
      setShares([]);
      if (interactive) setErr(e instanceof Error ? e.message : String(e)); else setNeedLogin(true);
    });
  };
  useEffect(() => { void load(false); }, []);

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-base font-medium">{tr('管理分享')}</h1>
      {err && <Banner variant="error" description={err} />}
      {shares === null && <div className="flex justify-center py-10"><Loader /></div>}
      {needLogin && (
        <Empty icon={<ShareNetwork size={40} />} title={tr('登录后查看你的分享')} description={tr('分享用 Google 账号确认身份，只读取邮箱。')} contents={<Button variant="primary" icon={<GoogleLogo />} onClick={() => void load(true)}>{tr('登录 Google')}</Button>} />
      )}
      {shares?.length === 0 && !err && !needLogin && (
        <Empty icon={<ShareNetwork size={40} />} title={tr('还没有分享')} description={tr('在抽屉的 ⋯ 菜单或工作区的右键菜单中选择「分享」。')} />
      )}
      {!!shares?.length && (
        <ul className="flex flex-col">
          {shares.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-kumo-tint">
              {s.kind === 'drawer' ? <Tray size={20} className="text-kumo-subtle" /> : <SquaresFour size={20} className="text-kumo-subtle" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="truncate">{s.title}</span>
                  <StatusBadge status={s.status} />
                  {s.pendingVersion !== null && s.status === 'live' && <Badge variant="neutral">{tr('更新审核中')}</Badge>}
                </div>
                <div className="truncate text-xs text-kumo-subtle">
                  {s.kind === 'drawer' ? tr('抽屉') : tr('工作区')} {tr('· 更新于')} {new Date(s.updatedAt).toLocaleDateString(dateLocale)}{s.rejectedNote ? tr(' · 未通过：{0}', s.rejectedNote) : ''}
                </div>
              </div>
              <Button size="sm" icon={<Copy />} onClick={() => void copyLink(s.url)}>{tr('复制链接')}</Button>
              <Button size="sm" variant="ghost" shape="square" icon={<ArrowSquareOut />} aria-label={tr('打开分享页')} onClick={() => void browser.tabs.create({ url: s.url })} />
              <Button size="sm" variant="ghost" shape="square" icon={<Trash />} aria-label={tr('取消分享')} onClick={async () => {
                if (!(await dialogs.confirm({ title: tr('取消分享「{0}」？', s.title), description: tr('公开页面和全部快照都会删除，链接失效。'), okText: tr('取消分享'), danger: true }))) return;
                try {
                  await deleteShare(s.id);
                  setShares((l) => l?.filter((x) => x.id !== s.id) ?? null);
                  toast(tr('已取消分享'));
                } catch (e) {
                  setErr(e instanceof Error ? e.message : String(e));
                }
              }} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
