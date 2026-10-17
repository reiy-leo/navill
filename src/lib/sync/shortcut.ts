import { tr } from '@/src/i18n';
/** ⌘S / Ctrl+S 手动同步的跳过规则：纯函数，便于单测 */
export const MIN_SHORTCUT_GAP = 3 * 60_000;

export type ShortcutSyncDecision = 'run' | 'signed-out' | 'off' | 'recent' | 'empty';

export function shortcutSyncDecision(i: {
  signedIn: boolean; enabled: boolean; lastSyncAt?: number; pending: number; now?: number;
}): ShortcutSyncDecision {
  if (!i.signedIn) return 'signed-out';
  if (!i.enabled) return 'off';
  if (i.lastSyncAt && (i.now ?? Date.now()) - i.lastSyncAt < MIN_SHORTCUT_GAP) return 'recent';
  if (i.pending <= 0) return 'empty';
  return 'run';
}

export const SHORTCUT_SYNC_TEXT: Record<Exclude<ShortcutSyncDecision, 'run'>, string> = {
  'signed-out': tr('未登录 Google，无法同步'),
  off: tr('同步未开启'),
  recent: tr('距上次同步不到 3 分钟，已跳过'),
  empty: tr('没有需要同步的内容'),
};
