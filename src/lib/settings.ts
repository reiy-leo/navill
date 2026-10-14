import { storage } from 'wxt/utils/storage';
import { MODE_DEFAULT } from '@/src/db';

/** 设置存 chrome.storage.local（按设备），不进 IndexedDB、不同步 */
export interface Settings {
  theme: 'system' | 'light' | 'dark';
  openMode: 'current' | 'new' | 'background';
  drawerName: 'full' | 'last';
  navLayout: 'sidebar' | 'top';
  navLabel: 'both' | 'icon' | 'name';
  sidebarCollapsed: boolean;
  startWorkspace: 'last' | string;
  lastWorkspaceId?: string;
  currentModeId: string;
  sync: {
    enabled: boolean;
    intervalMinutes: 0 | 5 | 15 | 60; // 0 = 仅手动
  };
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  openMode: 'current',
  drawerName: 'full',
  navLayout: 'sidebar',
  navLabel: 'both',
  sidebarCollapsed: false,
  startWorkspace: 'last',
  currentModeId: MODE_DEFAULT,
  sync: { enabled: false, intervalMinutes: 15 },
};

export const settingsItem = storage.defineItem<Settings>('local:settings', { fallback: DEFAULT_SETTINGS });

export async function getSettings(): Promise<Settings> {
  const s = await settingsItem.getValue();
  return { ...DEFAULT_SETTINGS, ...s, sync: { ...DEFAULT_SETTINGS.sync, ...s.sync } };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await settingsItem.setValue(next);
  return next;
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'ok' | 'error' | 'signed-out';
  lastSyncAt?: number;
  message?: string;
  account?: string;
}
export const syncStatusItem = storage.defineItem<SyncStatus>('local:syncStatus', { fallback: { state: 'signed-out' } });
