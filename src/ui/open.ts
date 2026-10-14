import { db } from '@/src/db';
import { recordOpen } from '@/src/lib/store';
import type { Settings } from '@/src/lib/settings';
import type { Item } from '@/src/lib/view';

/** 打开书签并计数。Ctrl/⌘/中键 = 后台新标签，Shift = 新标签前台 */
export async function openItem(
  item: Item, settings: Settings, e?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; button?: number },
  context: 'newtab' | 'popup' = 'newtab',
  /** 打开关联链接时传入；计数仍算在这个书签上 */
  urlOverride?: string,
) {
  const { placement } = item;
  const bookmark = { ...item.bookmark, url: urlOverride ?? item.bookmark.url };
  await recordOpen(db, bookmark.id, placement.id);
  let mode = settings.openMode;
  if (e?.ctrlKey || e?.metaKey || e?.button === 1) mode = 'background';
  else if (e?.shiftKey) mode = 'new';
  if (context === 'popup') {
    if (mode === 'current') {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) await browser.tabs.update(tab.id, { url: bookmark.url });
      else await browser.tabs.create({ url: bookmark.url });
    } else {
      await browser.tabs.create({ url: bookmark.url, active: mode === 'new' });
    }
    if (mode !== 'background') window.close();
    return;
  }
  if (mode === 'current') window.location.href = bookmark.url;
  else await browser.tabs.create({ url: bookmark.url, active: mode === 'new' });
}

/** 「全部打开」只在抽屉书签数 1..OPEN_ALL_MAX 时提供 */
export const OPEN_ALL_MAX = 10;

export async function openAll(items: Item[]) {
  if (items.length > OPEN_ALL_MAX) return;
  for (const it of items) {
    await recordOpen(db, it.bookmark.id, it.placement.id);
    await browser.tabs.create({ url: it.bookmark.url, active: false });
  }
}
