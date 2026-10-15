import { useEffect, useRef } from 'react';
import type { NavillDB } from '@/src/db';
import { onLogged } from '@/src/lib/log';
import { syncStatusItem, type Settings, type ToastEvent } from '@/src/lib/settings';
import { isConfigured, isSignedIn } from '@/src/lib/sync/auth';
import { pendingChanges, syncNow } from '@/src/lib/sync/engine';
import { SHORTCUT_SYNC_TEXT, shortcutSyncDecision } from '@/src/lib/sync/shortcut';
import { toast } from './toast';

export const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
/** 快捷键修饰键的显示名 */
export const modKey = () => (isMac() ? '⌘' : 'Ctrl+');

const VERB: Partial<Record<string, string>> = { create: '新建', edit: '修改', delete: '删除', move: '移动' };

/** 书签的新建 / 修改 / 删除 / 移动：按设置弹提醒；批量操作合并成一条 */
export function useLogToasts(settings: Settings) {
  const ref = useRef(settings);
  ref.current = settings;
  useEffect(() => onLogged((e) => {
    const verb = VERB[e.kind];
    if (e.targetType !== 'bookmark' || !verb || !ref.current.toast.show[e.kind as ToastEvent]) return;
    toast(e.summary, { group: `bm-${e.kind}`, format: (n) => `已${verb} ${n} 个书签` });
  }), []);
}

/** 从页面发起的同步：成功按设置提醒，失败抛出给调用方 */
export async function syncFromPage(db: NavillDB, settings: Settings) {
  await syncNow(db);
  if ((await syncStatusItem.getValue()).state === 'ok' && settings.toast.show.sync) toast('同步完成', { group: 'sync' });
}

/** ⌘S / Ctrl+S：3 分钟内同步过或没有改动时跳过并提醒 */
export async function shortcutSync(db: NavillDB, settings: Settings) {
  const status = await syncStatusItem.getValue();
  const decision = shortcutSyncDecision({
    signedIn: isConfigured() && (await isSignedIn()),
    enabled: settings.sync.enabled,
    lastSyncAt: status.lastSyncAt,
    pending: await pendingChanges(db),
  });
  if (decision !== 'run') {
    toast(SHORTCUT_SYNC_TEXT[decision], { type: 'info', group: 'sync-skip' });
    return;
  }
  toast('正在同步…', { type: 'info', group: 'sync' });
  try {
    await syncFromPage(db, settings);
  } catch (e) {
    toast(`同步失败：${e instanceof Error ? e.message : String(e)}`, { type: 'error', group: 'sync' });
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
        else ref.current.onSearch();
        return;
      }
      const t = e.target as HTMLElement;
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA'].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        ref.current.onSearch();
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, []);
}
