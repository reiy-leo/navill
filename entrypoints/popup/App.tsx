import { Button, Input, Select } from '@cloudflare/kumo';
import { BookmarkPlus, Check, Search } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db, type Bookmark } from '@/src/db';
import { createBookmark, ensureSeed } from '@/src/lib/store';
import { markDone } from '@/src/lib/onboarding';
import { bookmarkVisible, search, type Item } from '@/src/lib/view';
import { BookmarkIcon, hostOf } from '@/src/ui/icons';
import { ModeSwitcher } from '@/src/ui/ModeSwitcher';
import { openItem } from '@/src/ui/open';
import { AppStateProvider, useApp } from '@/src/ui/state';

import { tr } from '@/src/i18n';
const LAST_TARGET_KEY = 'navill-popup-target';

export default function App() {
  return (
    <AppStateProvider>
      <Popup />
    </AppStateProvider>
  );
}

function Popup() {
  const { visibility, settings } = useApp();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<{ title: string; url: string } | null>(null);
  const [target, setTarget] = useState<string>('');
  const [saved, setSaved] = useState(false);
  const [title, setTitle] = useState('');

  useEffect(() => {
    void ensureSeed(db);
    void browser.tabs.query({ active: true, currentWindow: true }).then(([t]) => {
      if (t?.url && /^https?:/.test(t.url)) { setTab({ title: t.title ?? t.url, url: t.url }); setTitle(t.title ?? t.url); }
    });
  }, []);

  const targets = useLiveQuery(async () => {
    const [ws, ds] = await Promise.all([db.workspaces.orderBy('order').toArray(), db.drawers.filter((d) => !d.archivedAt).toArray()]);
    const inbox = ws.find((w) => w.source === 'inbox');
    const items: Record<string, string> = {};
    if (inbox) items[`${inbox.id}|`] = tr('待整理');
    for (const w of ws) {
      if (w.source !== 'inbox') items[`${w.id}|`] = tr('{0} · 顶层', w.name);
      for (const d of ds.filter((x) => x.workspaceId === w.id).sort((a, b) => a.order - b.order)) items[`${w.id}|${d.id}`] = `${w.name} / ${d.name}`;
    }
    return items;
  }, []);
  useEffect(() => {
    // 默认选上次收藏的位置（本机记住），位置已删就退回第一个
    if (!target && targets) {
      const last = localStorage.getItem(LAST_TARGET_KEY);
      setTarget(last && last in targets ? last : (Object.keys(targets)[0] ?? ''));
    }
  }, [targets, target]);

  const already = useLiveQuery(async () => (tab ? (await db.bookmarks.where('url').equals(tab.url).count()) > 0 : false), [tab?.url]);

  const results = useLiveQuery(async (): Promise<Item[]> => {
    if (q.trim()) return (await search(db, q, visibility, 20)).map((h) => h.item);
    // 没有输入时显示最常用的书签
    const top: Bookmark[] = (await db.bookmarks.orderBy('id').toArray()).filter((b) => b.openCount > 0 && bookmarkVisible(b, visibility)).sort((a, b) => b.openCount - a.openCount).slice(0, 8);
    const out: Item[] = [];
    for (const b of top) {
      const p = await db.placements.where('bookmarkId').equals(b.id).first();
      if (p) out.push({ bookmark: b, placement: p });
    }
    return out;
  }, [q, visibility]);

  const save = async () => {
    if (!tab || !target || saved) return;
    const [wid, did] = target.split('|');
    localStorage.setItem(LAST_TARGET_KEY, target);
    await createBookmark(db, { url: tab.url, title: title.trim() || tab.title }, wid!, did || null);
    await markDone('savePage');
    setSaved(true);
    setTimeout(() => window.close(), 700);
  };

  return (
    <main className="navill-popup flex w-[360px] flex-col gap-3 p-3">
      {tab && (
        <section className="flex flex-col gap-2 rounded-xl border border-kumo-line bg-kumo-elevated p-2.5">
          <div className="flex items-center gap-2">
            <BookmarkIcon url={tab.url} size={16} />
            <Input
              autoFocus size="sm" className="min-w-0 flex-1" aria-label={tr('名称')} value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void save(); } }}
            />
          </div>
          {targets && (
            <Select aria-label={tr('收藏到')} size="sm" className="w-full" value={target} items={targets} onValueChange={(v) => v && setTarget(v as string)} />
          )}
          <Button size="sm" variant="primary" icon={saved ? <Check size="1em" /> : <BookmarkPlus size="1em" />} disabled={saved} onClick={() => void save()}>
            {saved ? tr('已收藏') : already ? tr('再收藏一份') : tr('收藏当前页')}
          </Button>
        </section>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-kumo-subtle" size={14} />
        <Input
          autoFocus={!tab}
          size="sm"
          className="w-full rounded-lg pl-7"
          placeholder={tr('搜索书签，#标签 筛选')}
          value={q}
          onChange={(e) => { setQ(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (!results?.length) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === 'Enter') void openItem(results[active]!, settings, e, 'popup');
          }}
          aria-label={tr('搜索')}
        />
      </div>
      <ul className="flex max-h-72 flex-col overflow-y-auto">
        {!q && results && results.length > 0 && <li className="px-2 pb-1 text-xs text-kumo-subtle">{tr('常用')}</li>}
        {results?.map((it, i) => (
          <li key={it.placement.id}>
            <button
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left ${i === active ? 'bg-kumo-tint' : 'hover:bg-kumo-tint'}`}
              onMouseEnter={() => setActive(i)}
              onClick={(e) => void openItem(it, settings, e, 'popup')}
              onAuxClick={(e) => e.button === 1 && void openItem(it, settings, e, 'popup')}
            >
              <BookmarkIcon url={it.bookmark.url} src={it.bookmark.faviconUrl} size={16} />
              <span className="min-w-0 flex-1 truncate text-sm">{it.bookmark.title}</span>
              <span className="max-w-24 truncate text-xs text-kumo-subtle">{hostOf(it.bookmark.url)}</span>
            </button>
          </li>
        ))}
        {q && results?.length === 0 && <li className="px-2 py-3 text-center text-xs text-kumo-subtle">{tr('没有找到')}</li>}
      </ul>
      <footer className="-mb-1 flex justify-end">
        <ModeSwitcher side="top" />
      </footer>
    </main>
  );
}
