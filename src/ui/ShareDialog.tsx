import { Badge, Banner, Button, Input, Switch } from '@cloudflare/kumo';
import { ArrowSquareOut, Copy, GoogleLogo, Trash } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { storage } from 'wxt/utils/storage';
import { db } from '@/src/db';
import { STATUS_LABEL, buildPayload, deleteShare, listShares, putShare, type MyShare, type ShareKind } from '@/src/lib/share';
import { Modal } from './Modal';
import { toast } from './toast';

const authorItem = storage.defineItem<string>('local:shareAuthor', { fallback: '' });

export const statusVariant = (s: MyShare['status']) => (s === 'live' ? 'primary' : s === 'pending' ? 'neutral' : 'destructive') as 'primary' | 'neutral' | 'destructive';

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
  const [err, setErr] = useState('');
  /** 分享要用 Google 账号确认身份：打开时先静默取 token，拿不到就只显示登录按钮 */
  const [needLogin, setNeedLogin] = useState(false);

  const load = (interactive: boolean) => {
    setErr('');
    return listShares(interactive).then(
      (l) => { setShare(l.find((x) => x.kind === kind && x.sourceId === sourceId) ?? null); setNeedLogin(false); },
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
      toast(share ? '已提交更新，审核通过后替换公开版本' : '已提交，审核通过后公开');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!share) return;
    setBusy(true); setErr('');
    try {
      await deleteShare(share.id);
      setShare(null);
      toast('已取消分享');
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
        <>
          {share && <Button variant="secondary-destructive" icon={<Trash />} disabled={busy} onClick={() => void remove()} className="mr-auto">取消分享</Button>}
          <Button onClick={onClose}>关闭</Button>
          {share !== undefined && <Button variant="primary" loading={busy} onClick={() => void submit()}>{share ? '更新分享' : '分享'}</Button>}
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
        {share !== undefined && <>
        {share && (
          <div className="flex items-center gap-2 rounded-lg border border-kumo-line px-3 py-2">
            <Badge variant={statusVariant(share.status)}>{STATUS_LABEL[share.status]}</Badge>
            {share.pendingVersion !== null && share.status === 'live' && <Badge variant="neutral">更新审核中</Badge>}
            <span className="min-w-0 flex-1 truncate text-xs text-kumo-subtle">{share.url}</span>
            <Button size="xs" variant="ghost" shape="square" icon={<Copy />} aria-label="复制链接" onClick={() => void copyLink(share.url)} />
            <Button size="xs" variant="ghost" shape="square" icon={<ArrowSquareOut />} aria-label="打开分享页" onClick={() => void browser.tabs.create({ url: share.url })} />
          </div>
        )}
        {share?.rejectedNote && <Banner variant="alert" description={`未通过：${share.rejectedNote}`} />}
        <Input value={author} maxLength={40} placeholder="作者名，留空显示「Navill 用户」" aria-label="作者名" onChange={(e) => setAuthor(e.target.value)} />
        <Input value={description} maxLength={300} placeholder="简介" aria-label="简介" onChange={(e) => setDescription(e.target.value)} />
        <Switch label="包含 18+ 内容" checked={includeAdult} onClick={() => setIncludeAdult(!includeAdult)} />
        </>}
      </div>
    </Modal>
  );
}
