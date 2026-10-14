import { useSyncExternalStore } from 'react';
import { getSettings, settingsItem, type Settings } from '@/src/lib/settings';

/** 工作区图标风格的全局订阅（所有 WorkspaceIcon 共用一个 storage 监听） */
type Style = Settings['workspaceIconStyle'];
let current: Style = 'emoji';
const subs = new Set<() => void>();
let started = false;
function start() {
  if (started) return;
  started = true;
  const refresh = () => void getSettings().then((s) => {
    if (s.workspaceIconStyle !== current) { current = s.workspaceIconStyle; subs.forEach((f) => f()); }
  });
  refresh();
  settingsItem.watch(refresh);
}
export function useIconStyle(): Style {
  return useSyncExternalStore((cb) => { start(); subs.add(cb); return () => subs.delete(cb); }, () => current);
}
