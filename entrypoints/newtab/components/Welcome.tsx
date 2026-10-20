import { Intro } from '@/src/ui/Intro';
import { Banner, Button, Empty, Text } from '@cloudflare/kumo';
import { BookmarksSimple, GoogleLogo, DownloadSimple, FileArrowUp, Plus } from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { PALETTE, db } from '@/src/db';
import { parseBackup, restoreBackup } from '@/src/lib/io/backup';
import { parseNetscapeHtml } from '@/src/lib/io/html';
import { skipImport } from '@/src/lib/import/commit';
import { createWorkspace } from '@/src/lib/store';
import { getSettings, updateSettings } from '@/src/lib/settings';
import { isConfigured } from '@/src/lib/sync/auth';
import { signInAndLog, syncNow } from '@/src/lib/sync/engine';
import type { BookmarkNode } from '@/src/lib/edge-workspace';
import { useDialogs } from '@/src/ui/dialogs';

import { tr } from '@/src/i18n';
export default function Welcome({ onImport }: { onImport: (tree?: BookmarkNode) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const dialogs = useDialogs();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setErr(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const fromDrive = () =>
    run('drive', async () => {
      await signInAndLog(db);
      await updateSettings({ sync: { ...(await getSettings()).sync, enabled: true, intervalMinutes: 15 } });
      await syncNow(db);
      const n = await db.workspaces.where('source').notEqual('inbox').count();
      if (n === 0 && (await db.bookmarks.count()) === 0) { setInfo(tr('已登录并开启同步。云端还没有数据，导入书签或新建工作区后会自动同步。')); return; }
      await db.meta.put({ key: 'importedAt', value: Date.now() });
    });

  const fromFile = (f: File) =>
    run('file', async () => {
      const text = await f.text();
      if (f.name.endsWith('.json') || text.trimStart().startsWith('{')) {
        await restoreBackup(db, parseBackup(text), 'replace');
      } else {
        onImport(parseNetscapeHtml(text));
      }
    });

  const newWorkspace = () =>
    run('new', async () => {
      const res = await dialogs.create(tr('工作区'), PALETTE[(await db.workspaces.filter((w) => w.source !== 'inbox').count()) % PALETTE.length]!);
      if (!res) return;
      await skipImport(db);
      await createWorkspace(db, { name: res.name, color: res.color, description: res.description.trim() || undefined, emoji: res.emoji || undefined, lucide: res.lucide, glyph: res.glyph || undefined });
    });

  return (
    <main className="flex min-h-full items-center justify-center p-8">
      <div className="w-full max-w-md">
        <Empty
          size="lg"
          icon={<BookmarksSimple size={48} />}
          title={tr('欢迎使用 Navill')}
        />
        <Intro className="mt-2" />
        {err && <div className="mt-4"><Banner variant="error" description={err} /></div>}
        {info && <div className="mt-4"><Banner description={info} /></div>}
        <div className="mt-6 grid gap-2">
          <Button className="w-full justify-center" variant="primary" size="lg" icon={<DownloadSimple />} onClick={() => onImport()}>{tr('导入浏览器书签')}</Button>
          <Button className="w-full justify-center" size="lg" icon={<GoogleLogo />} loading={busy === 'drive'} disabled={!isConfigured()} title={isConfigured() ? '' : tr('构建时未配置 Google OAuth 客户端 ID')} onClick={() => void fromDrive()}>{tr('登录 Google 同步')}</Button>
          <div className="my-2 flex items-center gap-3 text-xs text-kumo-subtle"><span className="h-px flex-1 bg-kumo-line" />{tr('其他方式')}<span className="h-px flex-1 bg-kumo-line" /></div>
          <Button className="w-full justify-center" icon={<FileArrowUp />} loading={busy === 'file'} onClick={() => file.current?.click()}>{tr('导入 JSON 备份 / 书签 HTML 文件')}</Button>
          <input ref={file} type="file" accept=".json,.html,.htm" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void fromFile(f); e.target.value = ''; }} />
          <Button className="w-full justify-center" icon={<Plus />} loading={busy === 'new'} onClick={() => void newWorkspace()}>{tr('新建工作区')}</Button>
          <Button className="w-full justify-center" variant="ghost" onClick={() => void skipImport(db)}>{tr('跳过，先用「待整理」收藏')}</Button>
        </div>
        <div className="mt-4 text-center"><Text variant="secondary" as="p">{tr('「待整理」始终存在，工具栏弹窗的「收藏当前页」会放进这里。')}</Text></div>
      </div>
    </main>
  );
}
