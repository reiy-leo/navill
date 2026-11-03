import { Button, Input } from '@cloudflare/kumo';
import { BookmarkPlus, Check, Search, SquareDashed } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '@/src/db';
import { createBookmark, ensureSeed } from '@/src/lib/store';
import { markDone } from '@/src/lib/onboarding';
import { BookmarkIcon, WorkspaceIcon, ICON } from '@/src/ui/icons';
import { AppStateProvider } from '@/src/ui/state';

import { tr } from '@/src/i18n';
const LAST_TARGET_KEY = 'navill-popup-target';

export default function App() {
  return (
    <AppStateProvider>
      <Popup />
    </AppStateProvider>
  );
}

type Kind = 'ws' | 'section' | 'drawer';
/** 收藏位置列表的一行。key = 工作区|抽屉|分区 */
type Row = { key: string; kind: Kind; depth: number; label: string; parent: string | null; wsKey: string };

function Popup() {
  const [tab, setTab] = useState<{ title: string; url: string } | null>(null);
  const [title, setTitle] = useState('');
  const [q, setQ] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    void ensureSeed(db);
    void browser.tabs.query({ active: true, currentWindow: true }).then(([t]) => {
      if (t?.url && /^https?:/.test(t.url)) { setTab({ title: t.title ?? t.url, url: t.url }); setTitle(t.title ?? t.url); }
    });
  }, []);

  const data = useLiveQuery(async () => {
    const [ws, ds] = await Promise.all([db.workspaces.orderBy('order').toArray(), db.drawers.filter((d) => !d.archivedAt).toArray()]);
    return { ws, ds };
  }, []);

  // 工作区 → 分区 → 抽屉，按层级缩进；待整理放最前
  const rows = useMemo(() => {
    if (!data) return null;
    const out: Row[] = [];
    const ws = [...data.ws.filter((w) => w.source === 'inbox'), ...data.ws.filter((w) => w.source !== 'inbox')];
    for (const w of ws) {
      const wk = `${w.id}||`;
      out.push({ key: wk, kind: 'ws', depth: 0, label: w.source === 'inbox' ? tr('待整理') : w.name, parent: null, wsKey: wk });
      if (w.source === 'inbox') continue;
      const sections = w.sections ?? [];
      const known = new Set(sections.map((s) => s.id));
      const drawers = data.ds.filter((d) => d.workspaceId === w.id).sort((a, b) => a.order - b.order);
      for (const d of drawers.filter((d) => !d.sectionId || !known.has(d.sectionId))) out.push({ key: `${w.id}|${d.id}|`, kind: 'drawer', depth: 1, label: d.name, parent: wk, wsKey: wk });
      for (const s of sections) {
        const sk = `${w.id}||${s.id}`;
        out.push({ key: sk, kind: 'section', depth: 1, label: s.name, parent: wk, wsKey: wk });
        for (const d of drawers.filter((d) => d.sectionId === s.id)) out.push({ key: `${w.id}|${d.id}|`, kind: 'drawer', depth: 2, label: d.name, parent: sk, wsKey: wk });
      }
    }
    return out;
  }, [data]);

  // 搜索：命中的行连同上级一起显示；上级命中时下级全部显示
  const shown = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    const byKey = new Map(rows.map((r) => [r.key, r]));
    const hit = new Set(rows.filter((r) => r.label.toLowerCase().includes(needle)).map((r) => r.key));
    const keep = new Set<string>();
    for (const r of rows) {
      let p: Row | undefined = r;
      let ok = false;
      while (p) { if (hit.has(p.key)) { ok = true; break; } p = p.parent ? byKey.get(p.parent) : undefined; }
      if (!ok) continue;
      for (let a: Row | undefined = r; a; a = a.parent ? byKey.get(a.parent) : undefined) keep.add(a.key);
    }
    return rows.filter((r) => keep.has(r.key));
  }, [rows, q]);

  useEffect(() => {
    // 默认选上次收藏的位置（本机记住），位置已删就退回第一个
    if (!target && rows?.length) {
      const last = localStorage.getItem(LAST_TARGET_KEY);
      setTarget(last && rows.some((r) => r.key === last) ? last : rows[0]!.key);
    }
  }, [rows, target]);

  useEffect(() => {
    // 搜索后当前选中项不在结果里，就选第一个命中项
    if (q.trim() && shown.length && !shown.some((r) => r.key === target)) setTarget(shown.find((r) => r.label.toLowerCase().includes(q.trim().toLowerCase()))?.key ?? shown[0]!.key);
  }, [q, shown, target]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [target]);

  const already = useLiveQuery(async () => (tab ? (await db.bookmarks.where('url').equals(tab.url).count()) > 0 : false), [tab?.url]);

  const save = async () => {
    if (!tab || !target || saved) return;
    const [wid, did, sid] = target.split('|');
    localStorage.setItem(LAST_TARGET_KEY, target);
    await createBookmark(db, { url: tab.url, title: title.trim() || tab.title }, wid!, did || null, sid || null);
    await markDone('savePage');
    setSaved(true);
    setTimeout(() => window.close(), 700);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    const i = shown.findIndex((r) => r.key === target);
    if (e.key === 'ArrowDown' && shown.length) { e.preventDefault(); setTarget(shown[Math.min(i + 1, shown.length - 1)]!.key); }
    if (e.key === 'ArrowUp' && shown.length) { e.preventDefault(); setTarget(shown[Math.max(i - 1, 0)]!.key); }
    if (e.key === 'Enter') { e.preventDefault(); void save(); }
  };

  if (!tab) return <main className="navill-popup w-[340px] p-4 text-center text-sm text-kumo-subtle">{tr('这个页面不能收藏')}</main>;

  const pad = ['pl-2', 'pl-7', 'pl-12'];
  return (
    <main className="navill-popup flex w-[340px] flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <BookmarkIcon url={tab.url} size={16} />
        <Input autoFocus size="sm" className="min-w-0 flex-1" aria-label={tr('名称')} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={onKey} />
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-kumo-subtle" size={14} />
        <Input size="sm" className="w-full pl-7" placeholder={tr('筛选工作区、分区或抽屉')} aria-label={tr('收藏到')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
      </div>
      <ul ref={listRef} role="listbox" aria-label={tr('收藏到')} className="flex max-h-64 flex-col overflow-y-auto [scrollbar-width:thin]">
        {shown.map((r) => {
          const ws = r.kind === 'ws' ? data?.ws.find((w) => `${w.id}||` === r.key) : undefined;
          const on = r.key === target;
          return (
            <li key={r.key} role="option" aria-selected={on}>
              <button
                className={`flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm ${pad[r.depth]} ${on ? 'bg-kumo-tint' : 'hover:bg-kumo-tint'} ${r.kind === 'ws' ? 'font-medium' : ''}`}
                onClick={() => setTarget(r.key)}
                onDoubleClick={() => { setTarget(r.key); void save(); }}
              >
                {ws && <WorkspaceIcon ws={ws} size={18} />}
                {r.kind === 'section' && <SquareDashed size={14} className="shrink-0 text-kumo-subtle" />}
                <span className="min-w-0 flex-1 truncate">{r.label}</span>
                {on && <Check size={14} className="shrink-0 text-kumo-brand" />}
              </button>
            </li>
          );
        })}
        {rows && shown.length === 0 && <li className="px-2 py-3 text-center text-xs text-kumo-subtle">{tr('没有找到')}</li>}
      </ul>
      <Button size="sm" variant="primary" className="w-full justify-center" icon={saved ? <Check size={ICON} /> : <BookmarkPlus size={ICON} />} disabled={saved || !target} onClick={() => void save()}>
        {saved ? tr('已收藏') : already ? tr('再收藏一份') : tr('收藏当前页')}
      </Button>
    </main>
  );
}
