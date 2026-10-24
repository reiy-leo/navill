import { storage } from 'wxt/utils/storage';
import { MODE_DEFAULT } from '@/src/db';

/** 设置存 chrome.storage.local；除按设备的项（SYNC_EXCLUDED）外随 Google Drive 同步，整体以修改时间新者胜 */
/** 抽屉排列：横条（一行一个）、瀑布、便当（120px 网格）、看板（一列一个，横向滚动） */
export type Arrange = 'strip' | 'masonry' | 'bento' | 'board';

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  openMode: 'current' | 'new' | 'background';
  drawerName: 'full' | 'last';
  /** 抽屉标题栏：始终显示，或默认被书签区盖住 80%、悬停时露出 */
  drawerHead: 'show' | 'peek';
  /** 每个工作区的抽屉排列方式（按设备），未设置为瀑布 */
  arrange: Record<string, Arrange>;
  /** 工作区导航位置：左右为侧边栏，上下为横条；都固定不随内容滚动 */
  navPosition: 'left' | 'right' | 'top' | 'bottom';
  navLabel: 'both' | 'icon' | 'name';
  /** 工作区图标风格：emoji 或 Lucide 线性图标 */
  workspaceIconStyle: 'emoji' | 'lucide' | 'char';
  /** 抽屉与书签的表面风格：色调卡片 / 磨砂玻璃 / 无框漂浮 */
  surface: 'tint' | 'glass' | 'bare';
  /** 页面背景：纯色（纯白/纯黑）/ 工作区颜色渐变 / Bing 每日图片 */
  background: 'plain' | 'gradient' | 'bing';
  /** 图片背景的模糊半径（px），0 为不模糊 */
  backgroundBlur: 0 | 8 | 24;
  startWorkspace: 'last' | 'home' | string;
  lastWorkspaceId?: string;
  currentModeId: string;
  sync: {
    enabled: boolean;
    intervalMinutes: 0 | 5 | 15 | 60; // 0 = 仅手动
    /** 可选同步：日志（工作区、抽屉、书签等核心数据始终同步） */
    logs: boolean;
  };
  toast: ToastSettings;
  /** 新手任务进度（随设置同步，见 src/lib/onboarding.ts） */
  onboarding: OnboardingState;
}

/** 新手任务：done 为任务 id → 完成时间；hidden 为用户关掉了卡片 */
export interface OnboardingState { done: Record<string, number>; hidden: boolean }

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
  drawerHead: 'show',
  arrange: {},
  navPosition: 'top',
  navLabel: 'name',
  workspaceIconStyle: 'emoji',
  surface: 'tint',
  background: 'gradient',
  backgroundBlur: 0,
  startWorkspace: 'last',
  currentModeId: MODE_DEFAULT,
  sync: { enabled: false, intervalMinutes: 15, logs: false },
  toast: DEFAULT_TOAST,
  onboarding: { done: {}, hidden: false },
};

export const settingsItem = storage.defineItem<Settings>('local:settings', { fallback: DEFAULT_SETTINGS });

export async function getSettings(): Promise<Settings> {
  const s = await settingsItem.getValue();
  // 旧版设置 navLayout: 'sidebar' | 'top' 迁移到 navPosition
  const legacy = (s as { navLayout?: string }).navLayout;
  return {
    ...DEFAULT_SETTINGS, ...s,
    navPosition: s.navPosition ?? (legacy === 'sidebar' ? 'left' : 'top'),
    sync: { ...DEFAULT_SETTINGS.sync, ...s.sync },
    toast: { ...DEFAULT_TOAST, ...s.toast, show: { ...DEFAULT_TOAST.show, ...s.toast?.show } },
    onboarding: { done: { ...s.onboarding?.done }, hidden: Boolean(s.onboarding?.hidden) },
  };
}

/** 只属于本机、不同步的设置 */
export const SYNC_EXCLUDED = ['lastWorkspaceId', 'currentModeId', 'sync'] as const;
export type SyncedSettings = Omit<Settings, (typeof SYNC_EXCLUDED)[number]>;
/** 同步设置的本地修改时间（只在同步项变化时更新） */
export const settingsModifiedItem = storage.defineItem<number>('local:settingsModifiedAt', { fallback: 0 });

export function syncedPart(s: Settings): SyncedSettings {
  const out = { ...s } as Record<string, unknown>;
  for (const k of SYNC_EXCLUDED) delete out[k];
  return out as unknown as SyncedSettings;
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const prev = await getSettings();
  const next = { ...prev, ...patch };
  await settingsItem.setValue(next);
  if (JSON.stringify(syncedPart(prev)) !== JSON.stringify(syncedPart(next))) await settingsModifiedItem.setValue(Date.now());
  return next;
}

/** 应用云端设置：保留本机项，不更新本地修改时间 */
export async function applyRemoteSettings(remote: Partial<SyncedSettings>, modifiedAt: number): Promise<void> {
  const cur = await getSettings();
  const clean = { ...remote } as Record<string, unknown>;
  for (const k of SYNC_EXCLUDED) delete clean[k];
  await settingsItem.setValue({ ...cur, ...clean });
  await settingsModifiedItem.setValue(modifiedAt);
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'ok' | 'error' | 'signed-out';
  lastSyncAt?: number;
  message?: string;
  account?: string;
}
export const syncStatusItem = storage.defineItem<SyncStatus>('local:syncStatus', { fallback: { state: 'signed-out' } });
