import { useEffect, useRef } from 'react';
import type { NavillDB } from '@/src/db';
import { onLogged } from '@/src/lib/log';
import { syncStatusItem, type Settings, type ToastEvent } from '@/src/lib/settings';
import { isConnected } from '@/src/lib/sync/backend';
import { pendingChanges, syncNow } from '@/src/lib/sync/engine';
import { SHORTCUT_SYNC_TEXT, shortcutSyncDecision } from '@/src/lib/sync/shortcut';
import { toast } from './toast';
import { ensureBookmarksConsent } from '@/src/lib/consent';
import { markDone } from '@/src/lib/onboarding';

import { tr } from '@/src/i18n';
export const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
/** 快捷键修饰键的显示名 */
export const modKey = () => (isMac() ? '⌘' : 'Ctrl+');

const COUNT: Partial<Record<string, (n: number) => string>> = {
  create: (n) => tr('已新建 {0} 个书签', n),
  edit: (n) => tr('已修改 {0} 个书签', n),
  delete: (n) => tr('已删除 {0} 个书签', n),
  move: (n) => tr('已移动 {0} 个书签', n),
};

/** 书签的新建 / 修改 / 删除 / 移动：按设置弹提醒；批量操作合并成一条 */
export function useLogToasts(settings: Settings) {
  const ref = useRef(settings);
  ref.current = settings;
  useEffect(() => onLogged((e) => {
    const format = COUNT[e.kind];
    if (e.targetType !== 'bookmark' || !format || !ref.current.toast.show[e.kind as ToastEvent]) return;
    toast(e.summary, { group: `bm-${e.kind}`, format });
  }), []);
}

/** 从页面发起的同步：成功按设置提醒，失败抛出给调用方 */
export async function syncFromPage(db: NavillDB, settings: Settings) {
  await ensureBookmarksConsent(); // Firefox 授权，须在第一个 await
  await syncNow(db);
  if ((await syncStatusItem.getValue()).state === 'ok' && settings.toast.show.sync) toast(tr('同步完成'), { group: 'sync' });
}

/** ⌘S / Ctrl+S：3 分钟内同步过或没有改动时跳过并提醒 */
export async function shortcutSync(db: NavillDB, settings: Settings) {
  const status = await syncStatusItem.getValue();
  const decision = shortcutSyncDecision({
    signedIn: await isConnected(),
    enabled: settings.sync.enabled,
    lastSyncAt: status.lastSyncAt,
    pending: await pendingChanges(db),
  });
  if (decision !== 'signed-out' && decision !== 'off') void markDone('syncKey');
  if (decision !== 'run') {
    toast(SHORTCUT_SYNC_TEXT[decision], { type: 'info', group: 'sync-skip' });
    return;
  }
  toast(tr('正在同步…'), { type: 'info', group: 'sync' });
  try {
    await syncFromPage(db, settings);
  } catch (e) {
    toast(tr('同步失败：{0}', e instanceof Error ? e.message : String(e)), { type: 'error', group: 'sync' });
  }
}

/** 页面快捷键：⌘S 同步、⌘L 搜索、/ 搜索。捕获阶段处理，先于浏览器默认行为 */
export function useShortcuts(h: { onSearch: () => void; onSync: () => void }) {
  const ref = useRef(h);
  ref.current = h;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = isMac() ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && !e.shiftKey && !e.altKey && (k === 's' || k === 'l')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat) return;
        if (k === 's') ref.current.onSync();
        else { ref.current.onSearch(); void markDone('searchKey'); }
        return;
      }
      const t = e.target as HTMLElement;
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA'].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        ref.current.onSearch();
        void markDone('searchKey');
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, []);
}
