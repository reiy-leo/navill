import { Button, Input, Loader } from '@cloudflare/kumo';
import { Pencil, Plus, RefreshCw, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '@/src/db';
import { tr } from '@/src/i18n';
import { cleanUser, dismissStar, dismissedStars, fetchStars, GitHubError, normUrl, type Star } from '@/src/lib/github';
import { createBookmark } from '@/src/lib/store';
import { markDone } from '@/src/lib/onboarding';
import { useDialogs } from '@/src/ui/dialogs';
import { useApp } from '@/src/ui/state';

/** 主页最多提醒几个 */
const MAX = 6;

/**
 * 主页「GitHub Star」：标题栏填 GitHub 用户名，读他的公开 star，
 * 列出还不在 Navill 里、也没被忽略的仓库，点「添加」选位置放进去。
 */
export function GitHubStars() {
  const { settings, updateSettings } = useApp();
  const dialogs = useDialogs();
  const user = settings.githubUser;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [stars, setStars] = useState<Star[] | null>(null);
  const [err, setErr] = useState('');
  const [dismissed, setDismissed] = useState(dismissedStars);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!user) { setStars(null); return; }
    let live = true;
    setErr('');
    fetchStars(user, { force: nonce > 0 }).then(
      (r) => { if (live) setStars(r); },
      (e) => {
        if (!live) return;
        setStars([]);
        const st = e instanceof GitHubError ? e.status : 0;
        setErr(st === 404 ? tr('找不到 GitHub 用户「{0}」（404 未找到）', user)
          : st === 403 || st === 429 ? tr('GitHub 请求太频繁，过一会儿再试（{0} 请求受限）', st)
          : tr('读取 GitHub star 失败：{0}', e instanceof Error ? e.message : String(e)));
      },
    );
    return () => { live = false; };
  }, [user, nonce]);

  // 已经在 Navill 里的网址
  const have = useLiveQuery(async () => {
    if (!stars?.length) return new Set<string>();
    const all = await db.bookmarks.toArray();
    return new Set(all.map((b) => normUrl(b.url)));
  }, [stars]);

  // 填过用户名（包括在别的设备上填的）就完成新手任务「添加你的 GitHub」
  useEffect(() => { if (user) void markDone('github'); }, [user]);

  const save = async () => {
    const u = cleanUser(draft);
    if (!u) return;
    setEditing(false);
    setStars(null);
    await updateSettings({ githubUser: u });
  };

  const add = async (s: Star) => {
    const t = await dialogs.pickTarget({ title: tr('把「{0}」放到…', s.fullName), allowTop: true });
    if (!t) return;
    await createBookmark(db, { url: s.url, title: s.fullName, note: s.description || undefined }, t.workspaceId, t.drawerId);
  };

  const ignore = (s: Star) => { dismissStar(s.url); setDismissed(dismissedStars()); };

  const showForm = !user || editing;
  const list = (stars ?? []).filter((s) => !dismissed.has(s.url) && !have?.has(normUrl(s.url))).slice(0, MAX);

  return (
    <section id="nv-github-stars" className="flex flex-col gap-3">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 className="text-base font-medium">{tr('GitHub Star')}</h2>
        {showForm ? (
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <Input
              size="sm"
              autoFocus={editing}
              aria-label={tr('GitHub 用户名')}
              placeholder={tr('GitHub 用户名')}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape' && user) setEditing(false); }}
            />
            <Button size="sm" type="submit" disabled={!cleanUser(draft)}>{tr('添加')}</Button>
          </form>
        ) : (
          <div className="flex items-center gap-1 text-sm text-kumo-subtle">
            <a href={`https://github.com/${user}?tab=stars`} target="_blank" rel="noopener noreferrer" className="hover:underline">@{user}</a>
            <Button size="sm" variant="ghost" shape="square" icon={<RefreshCw size={14} />} aria-label={tr('刷新')} onClick={() => { setStars(null); setNonce((n) => n + 1); }} />
            <Button size="sm" variant="ghost" shape="square" icon={<Pencil size={14} />} aria-label={tr('改 GitHub 用户名')} onClick={() => { setDraft(user); setEditing(true); }} />
          </div>
        )}
      </div>
      {!user ? (
        <p className="text-sm text-kumo-subtle">{tr('填上 GitHub 用户名，新 star 的仓库会出现在这里，一键加进 Navill。')}</p>
      ) : err ? (
        <p className="text-sm text-kumo-danger">{err}</p>
      ) : stars === null || !have ? (
        <div className="flex justify-center py-6"><Loader /></div>
      ) : list.length === 0 ? (
        <p className="text-sm text-kumo-subtle">{tr('最近 star 的仓库都已经在 Navill 里了。')}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {list.map((s) => (
            <div key={s.url} className="group relative flex flex-col gap-1 rounded-xl bg-kumo-elevated/75 p-3 ring-1 ring-kumo-line backdrop-blur-sm">
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="truncate pr-6 text-sm font-medium hover:underline">{s.fullName}</a>
              {s.description && <p className="line-clamp-2 text-xs text-kumo-subtle">{s.description}</p>}
              <div className="mt-auto flex items-center justify-between pt-1">
                <span className="truncate text-xs text-kumo-subtle">{s.language}</span>
                <Button size="xs" variant="secondary" icon={<Plus size="1em" />} onClick={() => void add(s)}>{tr('添加')}</Button>
              </div>
              <Button size="xs" variant="ghost" shape="square" icon={<X size={12} />} aria-label={tr('忽略')} className="absolute right-1.5 top-1.5 opacity-60 hover:opacity-100" onClick={() => ignore(s)} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
