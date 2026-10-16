import { Popover } from '@cloudflare/kumo';
import { X } from '@phosphor-icons/react';
import { db } from '@/src/db';
import { updateBookmark } from '@/src/lib/store';
import { useRef, useState, type CSSProperties, type ReactNode, type SyntheticEvent } from 'react';
import type { Item } from '@/src/lib/view';
import { BookmarkIcon, hostOf } from './icons';
import { openItem } from './open';
import { useApp } from './state';

/** 「更多」弹层里一列最多几条，更多时分多列 */
const PER_COLUMN = 6;

// 弹层经 portal 渲染，但 React 事件仍会冒泡到外层书签 <a>，统一拦下
const stop = (e: SyntheticEvent) => e.stopPropagation();

/** 悬停书签时显示（父元素需带 `group` 类） */
const SHOW = 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-has-[:focus-visible]:opacity-100 group-has-[:focus-visible]:pointer-events-auto';
/** 悬停书签时隐藏 */
const HIDE = 'transition-opacity duration-150 group-hover:opacity-0 group-has-[:focus-visible]:opacity-0';

interface Props {
  item: Item;
  /** 平时显示的内容（域名、标题等），悬停时淡出，换成关联链接图标条 */
  children?: ReactNode;
  /** replace：图标条替换 children；end：图标条浮在 children 右端，children 不隐藏 */
  placement?: 'replace' | 'end';
  /** 最多直接显示几个图标，多出的收进「+N」 */
  max?: number;
  align?: 'start' | 'center';
  context?: 'newtab' | 'popup';
}

/**
 * 关联链接图标条：平时不显示任何标记，悬停书签时，
 * 一排小图标从右往左依次滑入，点击图标打开对应关联链接。
 */
export function LinkStrip({ item, children, placement = 'replace', max = 5, align = 'start', context = 'newtab' }: Props) {
  const { settings } = useApp();
  const [open, setOpen] = useState(false);
  const more = useRef<HTMLButtonElement>(null);
  const b = item.bookmark;
  const links = b.links ?? [];
  if (links.length === 0) return <>{children}</>;
  const overflow = links.length > max;
  const shown = overflow ? links.slice(0, max - 1) : links;
  const rest = links.length - shown.length;

  const slot = (i: number): { className: string; style: CSSProperties } => ({
    className: `${SHOW} translate-x-1.5 transition-[opacity,transform] duration-200 ease-out group-hover:translate-x-0 group-has-[:focus-visible]:translate-x-0`,
    style: { transitionDelay: `${i * 25}ms` },
  });

  const strip = (
    <span
      className={`flex items-center gap-0.5 ${align === 'center' ? 'justify-center' : ''} ${
        placement === 'replace' ? 'absolute inset-0' : 'absolute right-0 top-1/2 -translate-y-1/2 rounded-md bg-kumo-tint pl-1'
      }`}
      onClick={stop}
      onAuxClick={stop}
      onContextMenu={stop}
    >
      {shown.map((l, i) => {
        const s = slot(i);
        return (
          <button
            key={`${i}-${l.url}`}
            type="button"
            title={l.title ? `${l.title}\n${l.url}` : l.url}
            aria-label={`打开关联链接：${l.title || hostOf(l.url)}`}
            draggable={false}
            className={`${s.className} flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-kumo-line`}
            style={s.style}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); void openItem(item, settings, e, context, l.url); }}
            onAuxClick={(e) => { if (e.button !== 1) return; e.preventDefault(); e.stopPropagation(); void openItem(item, settings, e, context, l.url); }}
          >
            <BookmarkIcon url={l.url} size={14} />
          </button>
        );
      })}
      {overflow && (() => {
        const s = slot(shown.length);
        return (
          <button
            ref={more}
            type="button"
            aria-label={`还有 ${rest} 个关联链接`}
            aria-expanded={open}
            draggable={false}
            className={`${s.className} flex h-5 shrink-0 cursor-pointer items-center rounded px-1 text-xs text-kumo-subtle hover:bg-kumo-line hover:text-kumo-default ${open ? '!opacity-100 !translate-x-0' : ''}`}
            style={s.style}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
          >
            +{rest}
          </button>
        );
      })()}
    </span>
  );

  return (
    <span className="relative block min-w-0">
      <span className={`block min-w-0 ${placement === 'replace' ? HIDE : ''}`}>{children ?? '\u00a0'}</span>
      {strip}
      {overflow && (
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) requestAnimationFrame(() => more.current?.blur()); }}>
          <Popover.Content anchor={more} side="bottom" align="start" sideOffset={6} className="p-1.5">
            <LinkList item={item} context={context} onOpened={() => setOpen(false)} />
          </Popover.Content>
        </Popover>
      )}
    </span>
  );
}

/** 「+N」弹层：完整关联链接列表，可删除单条 */
function LinkList({ item, context, onOpened }: { item: Item; context: 'newtab' | 'popup'; onOpened: () => void }) {
  const { settings } = useApp();
  const b = item.bookmark;
  const links = b.links ?? [];
  const rows = Math.min(links.length, PER_COLUMN);
  return (
    <div onClick={stop} onAuxClick={stop} onContextMenu={stop} onPointerDown={stop} onDragStart={stop}>
      <div className="grid grid-flow-col gap-x-1" style={{ gridTemplateRows: `repeat(${rows}, auto)` }}>
        {links.map((l, i) => (
          <div key={`${i}-${l.url}`} className="group/link relative">
            <a
              href={l.url}
              title={l.url}
              draggable={false}
              className="flex w-52 items-center gap-2 rounded-md px-2 py-1.5 text-kumo-default no-underline hover:bg-kumo-tint"
              onClick={(e) => { e.preventDefault(); onOpened(); void openItem(item, settings, e, context, l.url); }}
              onAuxClick={(e) => { if (e.button !== 1) return; e.preventDefault(); void openItem(item, settings, e, context, l.url); }}
            >
              <BookmarkIcon url={l.url} size={16} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{l.title || hostOf(l.url)}</span>
                {l.title && <span className="block truncate text-xs text-kumo-subtle">{hostOf(l.url)}</span>}
              </span>
            </a>
            {context === 'newtab' && (
              <button
                type="button"
                aria-label="删除这条关联链接"
                title="删除"
                className="absolute right-1 top-1/2 hidden h-5 w-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-kumo-subtle hover:bg-kumo-line hover:text-kumo-default group-hover/link:flex"
                onClick={() => void updateBookmark(db, b.id, { links: links.filter((_, j) => j !== i) })}
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
