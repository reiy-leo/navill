import { Checkbox, Empty, Loader } from '@cloudflare/kumo';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '@/src/db';
import { bookmarkMenu } from '@/src/ui/actions';
import { useContextMenu } from '@/src/ui/ContextMenu';
import { useDialogs } from '@/src/ui/dialogs';
import { BookmarkIcon, hostOf } from '@/src/ui/icons';
import { IconWithLinks } from '@/src/ui/LinksDot';
import { openItem } from '@/src/ui/open';
import { useApp } from '@/src/ui/state';
import { search, visibilityOf } from '@/src/lib/view';

export function SearchResults({ onOpen }: { onOpen?: () => void } = {}) {
  const { query, mode, settings, organize, selection, toggleSelect } = useApp();
  const [archived, setArchived] = useState(false);
  const [active, setActive] = useState(0);
  const menu = useContextMenu();
  const dialogs = useDialogs();
  const hits = useLiveQuery(() => search(db, query, visibilityOf(mode, archived)), [query, mode, archived]);
  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!hits?.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      if (e.key === 'Enter' && hits[active]) { e.preventDefault(); void openItem(hits[active]!.item, settings, e); onOpen?.(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hits, active, settings, onOpen]);

  if (!hits) return <div className="flex justify-center p-12"><Loader /></div>;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-kumo-subtle">{hits.length} 个结果 · 场景「{mode?.name}」</span>
        <Checkbox label="包含归档" checked={archived} onCheckedChange={(v) => setArchived(Boolean(v))} />
      </div>
      {hits.length === 0 ? (
        <Empty icon={<MagnifyingGlass size={40} />} title="没有找到" description="换个关键词，或切换到「默认」场景在全部工作区中搜索。" />
      ) : (
        <ul className="flex flex-col">
          {hits.map((h, i) => (
            <li key={h.item.placement.id}>
              <a
                href={h.item.bookmark.url}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-kumo-default no-underline ${i === active ? 'bg-kumo-tint' : 'hover:bg-kumo-tint'}`}
                onMouseEnter={() => setActive(i)}
                onClick={(e) => {
                  e.preventDefault();
                  if (organize) toggleSelect(h.item.placement.id);
                  else { void openItem(h.item, settings, e); onOpen?.(); }
                }}
                onContextMenu={(e) => menu(e, bookmarkMenu(h.item, dialogs, settings))}
              >
                {organize && <Checkbox checked={selection.has(h.item.placement.id)} aria-label="选择" />}
                <IconWithLinks item={h.item}><BookmarkIcon url={h.item.bookmark.url} src={h.item.bookmark.faviconUrl} size={20} /></IconWithLinks>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{h.item.bookmark.title}{h.item.bookmark.archivedAt ? ' · 已归档' : ''}</div>
                  <div className="truncate text-xs text-kumo-subtle">{hostOf(h.item.bookmark.url)}</div>
                </div>
                <span className="shrink-0 text-xs text-kumo-subtle">{h.workspace.name}{h.drawer ? ` / ${h.drawer.name}` : ''}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
