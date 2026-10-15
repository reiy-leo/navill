import { storage } from 'wxt/utils/storage';
import { MODE_DEFAULT } from '@/src/db';

/** 设置存 chrome.storage.local（按设备），不进 IndexedDB、不同步 */
export interface Settings {
  theme: 'system' | 'light' | 'dark';
  openMode: 'current' | 'new' | 'background';
  drawerName: 'full' | 'last';
  /** 抽屉标题栏：始终显示，或默认被书签区盖住 80%、悬停时露出 */
  drawerHead: 'show' | 'peek';
  navLayout: 'sidebar' | 'top';
  navLabel: 'both' | 'icon' | 'name';
  /** 工作区图标风格：emoji 或 Lucide 线性图标 */
  workspaceIconStyle: 'emoji' | 'lucide' | 'char';
  /** 抽屉与书签的表面风格：色调卡片 / 磨砂玻璃 / 无框漂浮 */
  surface: 'tint' | 'glass' | 'bare';
  sidebarCollapsed: boolean;
  startWorkspace: 'last' | string;
  lastWorkspaceId?: string;
  currentModeId: string;
  sync: {
    enabled: boolean;
    intervalMinutes: 0 | 5 | 15 | 60; // 0 = 仅手动
    /** 可选同步：日志（工作区、抽屉、书签等核心数据始终同步） */
    logs: boolean;
  };
  toast: ToastSettings;
}

export type ToastPosition = 'top-center' | 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left' | 'bottom-center';
export type ToastStyle = 'plain' | 'tinted' | 'dark' | 'pill';
/** 可开关的提醒内容；⌘S 跳过等直接反馈总是显示 */
export type ToastEvent = 'sync' | 'create' | 'edit' | 'delete' | 'move';
export interface ToastSettings {
  position: ToastPosition;
  style: ToastStyle;
  show: Record<ToastEvent, boolean>;
}
export const DEFAULT_TOAST: ToastSettings = {
  position: 'bottom-right',
  style: 'plain',
  show: { sync: true, create: true, edit: true, delete: true, move: true },
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  openMode: 'current',
  drawerName: 'full',
  drawerHead: 'peek',
  navLayout: 'sidebar',
  navLabel: 'both',
  workspaceIconStyle: 'emoji',
  surface: 'tint',
  sidebarCollapsed: false,
  startWorkspace: 'last',
  currentModeId: MODE_DEFAULT,
  sync: { enabled: false, intervalMinutes: 15, logs: false },
  toast: DEFAULT_TOAST,
};

export const settingsItem = storage.defineItem<Settings>('local:settings', { fallback: DEFAULT_SETTINGS });

export async function getSettings(): Promise<Settings> {
  const s = await settingsItem.getValue();
  return {
    ...DEFAULT_SETTINGS, ...s,
    sync: { ...DEFAULT_SETTINGS.sync, ...s.sync },
    toast: { ...DEFAULT_TOAST, ...s.toast, show: { ...DEFAULT_TOAST.show, ...s.toast?.show } },
  };
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
