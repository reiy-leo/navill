import { Badge, Banner, Button, Input, Switch } from '@cloudflare/kumo';
import { ArrowSquareOut, Copy, GoogleLogo } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { storage } from 'wxt/utils/storage';
import { db } from '@/src/db';
import { STATUS_LABEL, buildPayload, listShares, putShare, type MyShare, type ShareKind } from '@/src/lib/share';
import { getShareUser, type GoogleUser } from '@/src/lib/sync/auth';
import { Confetti } from './Confetti';
import { Modal } from './Modal';
import { toast } from './toast';

const SITE_ICON = 'https://navill.rei8t.dev/icon-192.png';
const authorItem = storage.defineItem<string>('local:shareAuthor', { fallback: '' });

/** 审核状态：审核中黄、已公开绿、未通过/已下架红 */
export function StatusBadge({ status, className = '' }: { status: MyShare['status']; className?: string }) {
  return <span data-status={status} className={`nv-status inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{STATUS_LABEL[status]}</span>;
}

export async function copyLink(url: string) {
  await navigator.clipboard.writeText(url);
  toast('已复制分享链接');
}

/** 分享抽屉 / 工作区：每次分享或更新都是一份快照，审核通过后公开 */
export function ShareDialog({ kind, sourceId, name, onClose }: { kind: ShareKind; sourceId: string; name: string; onClose: () => void }) {
  const [share, setShare] = useState<MyShare | null | undefined>(undefined);
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [includeAdult, setIncludeAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [err, setErr] = useState('');
  /** 分享要用 Google 账号确认身份：打开时先静默取 token，拿不到就只显示登录按钮 */
  const [needLogin, setNeedLogin] = useState(false);
  const [user, setUser] = useState<GoogleUser | null>(null);

  const load = (interactive: boolean) => {
    setErr('');
    return listShares(interactive).then(
      (l) => {
        setShare(l.find((x) => x.kind === kind && x.sourceId === sourceId) ?? null); setNeedLogin(false);
        void getShareUser().then((u) => { setUser(u); if (u?.name) setAuthor((a) => a || u.name!); });
      },
      (e) => { if (interactive) setErr(e instanceof Error ? e.message : String(e)); else setNeedLogin(true); },
    );
  };

  useEffect(() => {
    void authorItem.getValue().then(setAuthor);
    void (async () => {
      const d = kind === 'drawer' ? await db.drawers.get(sourceId) : await db.workspaces.get(sourceId);
      setDescription(d?.description ?? '');
    })();
    void load(false);
  }, [kind, sourceId]);

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      await authorItem.setValue(author.trim());
      const { payload, count } = await buildPayload(db, kind, sourceId, { includeAdult, author, description });
      if (!count) throw new Error('没有可以分享的书签');
      const s = await putShare(kind, sourceId, payload);
      setShare(s);
      setCelebrate(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const what = kind === 'drawer' ? '抽屉' : '工作区';
  return (
    <Modal
      open form size="base" onClose={onClose}
      title={`分享${what}「${name}」`}
      footer={
        share ? <Button variant="primary" onClick={onClose}>完成</Button> : <>
          <Button onClick={onClose}>关闭</Button>
          {share !== undefined && <Button variant="primary" loading={busy} onClick={() => void submit()}>分享</Button>}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {err && <Banner variant="error" description={err} />}
        {!needLogin && share === undefined && !err && <p className="py-6 text-center text-xs text-kumo-subtle">正在确认登录…</p>}
        {needLogin && share === undefined && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm">要用谷歌登录</p>
            <p className="text-xs text-kumo-subtle">分享用 Google 账号确认身份，只读取邮箱。</p>
            <Button variant="primary" icon={<GoogleLogo />} loading={busy} onClick={() => { setBusy(true); void load(true).finally(() => setBusy(false)); }}>用谷歌登录</Button>
          </div>
        )}
        {share && (
          <div className="flex flex-col items-center gap-2 py-2">
            {celebrate && <Confetti />}
            {share.rejectedNote && <p className="text-xs text-kumo-danger">未通过：{share.rejectedNote}</p>}
            <div className="relative flex aspect-square w-56 flex-col items-center justify-center gap-3 rounded-2xl border border-kumo-line bg-kumo-base p-4">
              <StatusBadge status={share.status} className="absolute right-2.5 top-2.5" />
              <img src={SITE_ICON} alt="" className="size-16 rounded-2xl" />
              <span className="w-full truncate text-center text-xs text-kumo-subtle" title={share.url}>{share.url.replace(/^https:\/\//, "")}</span>
              <div className="flex gap-1">
                <Button size="sm" shape="square" icon={<Copy />} aria-label="复制链接" title="复制链接" onClick={() => void copyLink(share.url)} />
                <Button size="sm" shape="square" icon={<ArrowSquareOut />} aria-label="打开分享页" title="打开分享页" onClick={() => void browser.tabs.create({ url: share.url })} />
              </div>
            </div>
          </div>
        )}
        {share === null && <>
        {user && (
          <div className="flex items-center gap-2 text-xs text-kumo-subtle">
            {user.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" className="size-5 rounded-full" /> : <GoogleLogo size={16} />}
            <span className="min-w-0 truncate">已用谷歌登录：{user.name ? `${user.name} · ` : ''}{user.email}</span>
          </div>
        )}
        <Input value={author} maxLength={40} placeholder="作者名，留空显示「Navill 用户」" aria-label="作者名" onChange={(e) => setAuthor(e.target.value)} />
        <Input value={description} maxLength={300} placeholder="简介" aria-label="简介" onChange={(e) => setDescription(e.target.value)} />
        <Switch label="包含 18+ 内容" checked={includeAdult} onClick={() => setIncludeAdult(!includeAdult)} />
        </>}
      </div>
    </Modal>
  );
}
