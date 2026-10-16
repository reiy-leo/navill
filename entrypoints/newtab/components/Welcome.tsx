import { Banner, Button, Empty, Text } from '@cloudflare/kumo';
import { BookmarksSimple, CloudArrowDown, DownloadSimple, FileArrowUp, Plus } from '@phosphor-icons/react';
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

export default function Welcome({ onImport }: { onImport: (tree?: BookmarkNode) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const dialogs = useDialogs();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setErr(null);
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
      if (n === 0 && (await db.bookmarks.count()) === 0) throw new Error('云端还没有 Navill 数据');
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
      const res = await dialogs.create('工作区', PALETTE[(await db.workspaces.filter((w) => w.source !== 'inbox').count()) % PALETTE.length]!);
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
          title="欢迎使用 Navill"
          description="导入浏览器书签，按「工作区 → 抽屉 → 书签」重新整理。导入只读取浏览器书签，不会改动它们。"
        />
        {err && <div className="mt-4"><Banner variant="error" description={err} /></div>}
        <div className="mt-6 grid gap-2">
          <Button className="w-full justify-center" variant="primary" size="lg" icon={<DownloadSimple />} onClick={() => onImport()}>导入浏览器书签</Button>
          <Button className="w-full justify-center" icon={<CloudArrowDown />} loading={busy === 'drive'} disabled={!isConfigured()} title={isConfigured() ? '' : '构建时未配置 Google OAuth 客户端 ID'} onClick={() => void fromDrive()}>从 Google Drive 恢复</Button>
          <Button className="w-full justify-center" icon={<FileArrowUp />} loading={busy === 'file'} onClick={() => file.current?.click()}>导入 JSON 备份 / 书签 HTML 文件</Button>
          <input ref={file} type="file" accept=".json,.html,.htm" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void fromFile(f); e.target.value = ''; }} />
          <Button className="w-full justify-center" icon={<Plus />} loading={busy === 'new'} onClick={() => void newWorkspace()}>新建工作区</Button>
          <Button className="w-full justify-center" variant="ghost" onClick={() => void skipImport(db)}>跳过，先用「待整理」收藏</Button>
        </div>
        <div className="mt-4 text-center"><Text variant="secondary" as="p">「待整理」始终存在，工具栏弹窗的「收藏当前页」会放进这里。</Text></div>
      </div>
    </main>
  );
}
