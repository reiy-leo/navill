import { Checkbox } from '@cloudflare/kumo';
import { Copy, LinkSimple, Star } from '@phosphor-icons/react';
import { useState } from 'react';
import { TAG_FAVORITE, db, type ViewMode } from '@/src/db';
import { toggleTagOn } from '@/src/lib/store';
import type { Item } from '@/src/lib/view';
import { bookmarkMenu } from '@/src/ui/actions';
import { useContextMenu } from '@/src/ui/ContextMenu';
import { useDialogs } from '@/src/ui/dialogs';
import { BookmarkIcon, hostOf } from '@/src/ui/icons';
import { LinkStrip } from '@/src/ui/LinkStrip';
import { openItem } from '@/src/ui/open';
import { useApp } from '@/src/ui/state';
import { DND_PLACEMENT, hasType, insertAfter } from './dnd';

import { tr } from '@/src/i18n';
interface Props {
  items: Item[];
  view: ViewMode;
  /** 放下书签：插入到 index（基于 items 中可拖拽的自有书签） */
  onDrop?: (placementId: string, index: number) => void;
  onReveal?: (item: Item) => void;
  emptyHint?: string;
  /** 横条排列：书签横向排成一行，超出时横向滚动 */
  strip?: boolean;
}

/** 横条排列时每个书签的固定宽度 */
const STRIP_W: Record<ViewMode, string> = { icon: 'w-[84px]', row: 'w-44', tile: 'w-48', bento: 'w-48' };

const LAYOUT: Record<ViewMode, string> = {
  icon: 'grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-1',
  row: 'flex flex-col',
  tile: 'grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2',
  bento: 'grid grid-cols-4 auto-rows-[64px] gap-2 grid-flow-dense',
};

export function Items({ items, view, onDrop, onReveal, emptyHint, strip }: Props) {
  const [over, setOver] = useState(false);
  // bento：按打开次数排名决定大小
  const rank = new Map(
    [...items].sort((a, b) => b.bookmark.openCount - a.bookmark.openCount).map((it, i) => [it.placement.id, i]),
  );
  return (
    <div
      className={`${strip ? `flex ${view === 'icon' ? 'gap-1' : 'gap-2'} overflow-x-auto [scrollbar-width:thin]` : LAYOUT[view]} min-h-8 rounded-md ${over ? 'bg-kumo-tint outline-2 outline-dashed outline-kumo-line' : ''}`}
      onDragOver={(e) => {
        if (!onDrop || !hasType(e, DND_PLACEMENT)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const id = e.dataTransfer.getData(DND_PLACEMENT);
        if (!onDrop || !id) return;
        e.preventDefault();
        onDrop(id, items.filter((i) => !i.mountedFrom).length);
      }}
    >
      {items.length === 0 && emptyHint && <div className="col-span-full px-2 py-3 text-center text-xs text-kumo-subtle">{emptyHint}</div>}
      {items.map((it, i) => (
        <BookmarkItem
          key={it.placement.id + (it.mountedFrom?.group.id ?? '')}
          item={it}
          view={view}
          strip={strip}
          size={!strip && view === 'bento' ? (rank.get(it.placement.id)! === 0 ? 'xl' : rank.get(it.placement.id)! < 3 ? 'lg' : 'sm') : 'sm'}
          onDropBefore={onDrop ? (id, after) => onDrop(id, after ? i + 1 : i) : undefined}
          onReveal={onReveal}
        />
      ))}
    </div>
  );
}

function BookmarkItem({
  item, view, size, strip, onDropBefore, onReveal,
}: { item: Item; view: ViewMode; strip?: boolean; size: 'sm' | 'lg' | 'xl'; onDropBefore?: (placementId: string, after: boolean) => void; onReveal?: (i: Item) => void }) {
  const { settings, organize, selection, toggleSelect } = useApp();
  const menu = useContextMenu();
  const dialogs = useDialogs();
  const [dropSide, setDropSide] = useState<'before' | 'after' | null>(null);
  const { bookmark: b, placement: p, mountedFrom } = item;
  const selected = selection.has(p.id);
  const fav = b.tagIds.includes(TAG_FAVORITE);
  const horizontal = strip || view !== 'row';
  const badge = mountedFrom ? (
    <LinkSimple size={14} className="shrink-0 text-kumo-subtle" aria-label={tr('挂载')} />
  ) : p.isAlias ? (
    <Copy size={14} className="shrink-0 text-kumo-subtle" aria-label={tr('分身')} />
  ) : null;
  const title = [b.title, b.url, b.note, mountedFrom ? tr('源自抽屉「{0}」', mountedFrom.drawer.name) : p.isAlias ? tr('分身') : '', b.openCount ? tr('打开 {0} 次', b.openCount) : '']
    .filter(Boolean)
    .join('\n');

  const body = (() => {
    switch (view) {
      case 'icon':
        return (
          <div className="flex flex-col items-center gap-1 p-2 text-center">
            <div className="nv-plate relative rounded-xl p-2"><BookmarkIcon url={b.url} src={b.faviconUrl} size={32} /><span className="absolute -bottom-1 -left-1">{badge}</span></div>
            <span className="w-full"><LinkStrip item={item} max={3} align="center"><span className="line-clamp-2 w-full break-all text-xs leading-tight">{b.title}</span></LinkStrip></span>
          </div>
        );
      case 'row':
        return (
          <div className={`flex items-center gap-2 py-1 pl-2 ${organize ? 'pr-2' : 'pr-6'}`}>
            <BookmarkIcon url={b.url} src={b.faviconUrl} size={16} />
            <span className="min-w-0 flex-1"><LinkStrip item={item} placement="end" max={6}><span className="block truncate text-sm">{b.title}</span></LinkStrip></span>
            {badge}
          </div>
        );
      case 'tile':
        return (
          <div className="flex items-center gap-2 nv-tile rounded-lg border border-kumo-line bg-kumo-base/80 p-2">
            <BookmarkIcon url={b.url} src={b.faviconUrl} size={24} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{b.title}</div>
              <LinkStrip item={item}><div className="truncate text-xs text-kumo-subtle">{hostOf(b.url)}</div></LinkStrip>
            </div>
            {badge}
          </div>
        );
      case 'bento':
        return (
          <div className="flex h-full flex-col justify-between nv-tile rounded-lg border border-kumo-line bg-kumo-base/80 p-2">
            <div className="flex items-center justify-between">
              <BookmarkIcon url={b.url} src={b.faviconUrl} size={size === 'sm' ? 20 : 32} />
              {badge}
            </div>
            <div className="min-w-0">
              <div className={`${size === 'xl' ? 'line-clamp-3 text-base font-medium' : 'truncate text-sm'}`}>{b.title}</div>
              {size !== 'sm' ? <LinkStrip item={item}><div className="truncate text-xs text-kumo-subtle">{hostOf(b.url)}</div></LinkStrip> : <LinkStrip item={item} max={4} />}
            </div>
          </div>
        );
    }
  })();

  const span = strip ? `shrink-0 ${STRIP_W[view]}` : view === 'bento' ? (size === 'xl' ? 'col-span-2 row-span-2' : size === 'lg' ? 'col-span-2' : '') : '';
  return (
    <a
      href={b.url}
      title={title}
      draggable={!mountedFrom && !organize}
      className={`group relative block rounded-md text-kumo-default no-underline hover:bg-kumo-tint ${span} ${selected ? 'bg-kumo-tint ring-2 ring-kumo-brand' : ''} ${
        dropSide === 'before' ? (horizontal ? 'shadow-[inset_3px_0_0_var(--color-kumo-brand)]' : 'shadow-[inset_0_3px_0_var(--color-kumo-brand)]') : ''
      } ${dropSide === 'after' ? (horizontal ? 'shadow-[inset_-3px_0_0_var(--color-kumo-brand)]' : 'shadow-[inset_0_-3px_0_var(--color-kumo-brand)]') : ''}`}
      onClick={(e) => {
        e.preventDefault();
        if (organize) {
          if (!mountedFrom) toggleSelect(p.id);
          return;
        }
        void openItem(item, settings, e);
      }}
      onAuxClick={(e) => {
        if (e.button !== 1) return;
        e.preventDefault();
        void openItem(item, settings, e);
      }}
      onContextMenu={(e) => menu(e, bookmarkMenu(item, dialogs, settings, { onReveal }))}
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_PLACEMENT, p.id);
        e.dataTransfer.setData('text/uri-list', b.url);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        if (!onDropBefore || !hasType(e, DND_PLACEMENT)) return;
        e.preventDefault();
        e.stopPropagation();
        setDropSide(insertAfter(e, horizontal) ? 'after' : 'before');
      }}
      onDragLeave={() => setDropSide(null)}
      onDrop={(e) => {
        const side = dropSide;
        setDropSide(null);
        const id = e.dataTransfer.getData(DND_PLACEMENT);
        if (!onDropBefore || !id) return;
        e.preventDefault();
        e.stopPropagation();
        if (id !== p.id) onDropBefore(id, side === 'after');
      }}
    >
      {organize && !mountedFrom && (
        <span className="absolute left-1 top-1 z-10" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected} onCheckedChange={(v) => toggleSelect(p.id, Boolean(v))} aria-label={tr('选择')} />
        </span>
      )}
      <div className={organize && !mountedFrom ? 'pl-6' : ''}>{body}</div>
      {!organize && (
        <button
          type="button"
          draggable={false}
          aria-label={fav ? tr('取消收藏') : tr('收藏')}
          title={fav ? tr('取消收藏') : tr('收藏')}
          className={`absolute right-0.5 z-10 flex size-5 ${view === 'row' ? 'top-1/2 -translate-y-1/2' : 'top-0.5'} items-center justify-center rounded transition-opacity ${fav ? 'text-[#f5b301]' : 'text-kumo-subtle opacity-0 hover:text-[#f5b301] group-hover:opacity-100 focus-visible:opacity-100'}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void toggleTagOn(db, [b.id], TAG_FAVORITE, !fav);
          }}
        >
          <Star size={13} weight={fav ? 'fill' : 'regular'} />
        </button>
      )}
    </a>
  );
}
