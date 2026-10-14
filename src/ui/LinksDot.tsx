import { Button, Popover } from '@cloudflare/kumo';
import { PencilSimple, Plus, X } from '@phosphor-icons/react';
import { db } from '@/src/db';
import { updateBookmark } from '@/src/lib/store';
import { useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import type { Item } from '@/src/lib/view';
import { useDialogs } from './dialogs';
import { BookmarkIcon, hostOf } from './icons';
import { openItem } from './open';
import { useApp } from './state';

/** 一列最多几条，更多时分多列 */
const PER_COLUMN = 6;

// 弹层经 portal 渲染，但 React 事件仍会冒泡到外层书签 <a>，统一拦下
const stop = (e: SyntheticEvent) => e.stopPropagation();

/** 书签图标 + 关联链接小红点。没有关联链接时只渲染图标 */
export function IconWithLinks({ item, children, context = 'newtab' }: { item: Item; children: ReactNode; context?: 'newtab' | 'popup' }) {
  const { settings } = useApp();
  const dialogs = useDialogs();
  const [open, setOpen] = useState(false);
  const dot = useRef<HTMLButtonElement>(null);
  const b = item.bookmark;
  const links = b.links ?? [];
  if (links.length === 0) return <>{children}</>;
  const all = [{ url: b.url, title: b.title }, ...links];
  const rows = Math.min(all.length, PER_COLUMN);
  return (
    <span className="relative inline-flex shrink-0">
      {children}
      <button
        ref={dot}
        type="button"
        aria-label={`关联链接（${links.length}）`}
        aria-expanded={open}
        title={`关联链接（${links.length}）`}
        className="absolute -right-1.5 -top-1.5 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        onAuxClick={stop}
        onContextMenu={stop}
        draggable={false}
      >
        <span className="h-2 w-2 rounded-full bg-red-500 ring-2 ring-kumo-base" />
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <Popover.Content anchor={dot} side="right" align="start" sideOffset={8} className="p-1.5">
          <div onClick={stop} onAuxClick={stop} onContextMenu={stop} onPointerDown={stop} onDragStart={stop}>
            <div className="grid grid-flow-col gap-x-1" style={{ gridTemplateRows: `repeat(${rows}, auto)` }}>
              {all.map((l, i) => (
                <div key={`${i}-${l.url}`} className="group/link relative">
                <a
                  href={l.url}
                  title={l.url}
                  draggable={false}
                  className="flex w-52 items-center gap-2 rounded-md px-2 py-1.5 text-kumo-default no-underline hover:bg-kumo-tint"
                  onClick={(e) => { e.preventDefault(); setOpen(false); void openItem(item, settings, e, context, l.url); }}
                  onAuxClick={(e) => { if (e.button !== 1) return; e.preventDefault(); void openItem(item, settings, e, context, l.url); }}
                >
                  <BookmarkIcon url={l.url} src={i === 0 ? b.faviconUrl : undefined} size={16} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${i === 0 ? 'font-medium' : ''}`}>{l.title || hostOf(l.url)}</span>
                    {l.title && <span className="block truncate text-xs text-kumo-subtle">{hostOf(l.url)}</span>}
                  </span>
                </a>
                {i > 0 && context === 'newtab' && (
                  <button
                    type="button"
                    aria-label="删除这条关联链接"
                    title="删除"
                    className="absolute right-1 top-1/2 hidden h-5 w-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-kumo-subtle hover:bg-kumo-line hover:text-kumo-default group-hover/link:flex"
                    onClick={() => void updateBookmark(db, b.id, { links: links.filter((_, j) => j !== i - 1) })}
                  >
                    <X size={12} />
                  </button>
                )}
                </div>
              ))}
            </div>
            {context === 'newtab' && (
              <div className="mt-1 flex justify-end gap-1 border-t border-kumo-line pt-1">
                <Button size="xs" variant="ghost" icon={<Plus />} onClick={() => { setOpen(false); dialogs.editBookmark(b.id); }}>添加</Button>
                <Button size="xs" variant="ghost" icon={<PencilSimple />} onClick={() => { setOpen(false); dialogs.editBookmark(b.id); }}>编辑</Button>
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover>
    </span>
  );
}
