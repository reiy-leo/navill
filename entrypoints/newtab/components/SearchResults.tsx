import { Checkbox, Empty, Loader } from '@cloudflare/kumo';
import { FolderOpen, Search } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';
import { db } from '@/src/db';
import { bookmarkMenu } from '@/src/ui/actions';
import { useContextMenu } from '@/src/ui/ContextMenu';
import { useDialogs } from '@/src/ui/dialogs';
import { BookmarkIcon, hostOf } from '@/src/ui/icons';
import { LinkStrip } from '@/src/ui/LinkStrip';
import { openItem } from '@/src/ui/open';
import { useApp, useQuery, useSelection } from '@/src/ui/state';
import { search, searchDrawers, visibilityOf, type DrawerHit } from '@/src/lib/view';
import { revealDrawer } from '@/src/ui/reveal';

import { tr } from '@/src/i18n';
export function SearchResults({ onOpen }: { onOpen?: () => void } = {}) {
  const { mode, settings, selectWorkspace } = useApp();
  const { query } = useQuery();
  const { organize, selection, toggleSelect } = useSelection();
  const [archived, setArchived] = useState(false);
  const [active, setActive] = useState(0);
  const menu = useContextMenu();
  const dialogs = useDialogs();
  const hits = useLiveQuery(() => search(db, query, visibilityOf(mode, archived)), [query, mode, archived]);
  const drawerHits = useLiveQuery(() => searchDrawers(db, query, visibilityOf(mode)), [query, mode]);
  const nd = drawerHits?.length ?? 0;
  const total = nd + (hits?.length ?? 0);
  useEffect(() => setActive(0), [query]);
  const goDrawer = useCallback((h: DrawerHit) => {
    selectWorkspace(h.workspace.id);
    revealDrawer(h.drawer.id);
    onOpen?.();
  }, [selectWorkspace, onOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!total) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, total - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      if (e.key === 'Enter') {
        const d = drawerHits?.[active];
        const b = hits?.[active - nd];
        if (d) { e.preventDefault(); goDrawer(d); }
        else if (b) { e.preventDefault(); void openItem(b.item, settings, e); onOpen?.(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hits, drawerHits, nd, total, active, settings, onOpen, goDrawer]);

  if (!hits || !drawerHits) return <div className="flex justify-center p-12"><Loader /></div>;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-kumo-subtle">{total} {tr('个结果 · 场景「')}{mode?.name}」</span>
        <Checkbox label={tr('包含归档')} checked={archived} onCheckedChange={(v) => setArchived(Boolean(v))} />
      </div>
      {total === 0 ? (
        <Empty icon={<Search size={40} />} title={tr('没有找到')} description={tr('换个关键词，或切换到「默认」场景在全部工作区中搜索。')} />
      ) : (
        <ul className="flex flex-col">
          {drawerHits.map((h, i) => (
            <li key={`d-${h.drawer.id}`}>
              <button
                type="button"
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-kumo-default ${i === active ? 'bg-kumo-tint' : 'hover:bg-kumo-tint'}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => goDrawer(h)}
              >
                <FolderOpen size={20} className="shrink-0 text-kumo-subtle" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{h.drawer.name}</div>
                  {h.drawer.description && <div className="truncate text-xs text-kumo-subtle">{h.drawer.description}</div>}
                </div>
                <span className="shrink-0 text-xs text-kumo-subtle">{tr('抽屉')} · {h.workspace.name}</span>
              </button>
            </li>
          ))}
          {hits.map((h, j) => { const i = j + nd; return (
            <li key={h.item.placement.id}>
              <a
                href={h.item.bookmark.url}
                className={`group flex items-center gap-3 rounded-md px-3 py-2 text-kumo-default no-underline ${i === active ? 'bg-kumo-tint' : 'hover:bg-kumo-tint'}`}
                onMouseEnter={() => setActive(i)}
                onClick={(e) => {
                  e.preventDefault();
                  if (organize) toggleSelect(h.item.placement.id);
                  else { void openItem(h.item, settings, e); onOpen?.(); }
                }}
                onContextMenu={(e) => menu(e, bookmarkMenu(h.item, dialogs, settings))}
              >
                {organize && <Checkbox checked={selection.has(h.item.placement.id)} aria-label={tr('选择')} />}
                <BookmarkIcon url={h.item.bookmark.url} src={h.item.bookmark.faviconUrl} size={20} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{h.item.bookmark.title}{h.item.bookmark.archivedAt ? tr(' · 已归档') : ''}</div>
                  <LinkStrip item={h.item} max={6}><div className="truncate text-xs text-kumo-subtle">{hostOf(h.item.bookmark.url)}</div></LinkStrip>
                </div>
                <span className="shrink-0 text-xs text-kumo-subtle">{h.workspace.name}{h.drawer ? ` / ${h.drawer.name}` : ''}</span>
              </a>
            </li>
          ); })}
        </ul>
      )}
    </div>
  );
}
