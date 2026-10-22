import { tr } from '@/src/i18n';

/**
 * Firefox 数据收集授权：manifest 里 bookmarksInfo 声明为可选，传书签数据出去（Google Drive / WebDAV 同步、发布分享）前要用户同意。
 * Chromium 没有这套机制，一律视为已同意。
 * 注意：permissions.request 只能在用户操作的处理函数里、第一个 await 之前调用。
 */
type Perms = Parameters<typeof browser.permissions.request>[0] & { data_collection?: string[] };

export const NEEDS_DATA_CONSENT = import.meta.env.BROWSER === 'firefox';
const BOOKMARKS: Perms = { data_collection: ['bookmarksInfo'] };

/** 在其他授权请求里顺带申请（一次点击只能弹一次授权框，要合并成一个请求） */
export const withBookmarksConsent = (p: Perms): Perms => (NEEDS_DATA_CONSENT ? { ...p, ...BOOKMARKS } : p);

export function hasBookmarksConsent(): Promise<boolean> {
  if (!NEEDS_DATA_CONSENT) return Promise.resolve(true);
  try {
    return browser.permissions.contains(BOOKMARKS).catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

/** 请求授权；不在用户操作里（例如快捷键处理中途已 await 过）调用会被浏览器拒绝，这时退回查询是否已授权 */
export function requestBookmarksConsent(): Promise<boolean> {
  if (!NEEDS_DATA_CONSENT) return Promise.resolve(true);
  try {
    return browser.permissions.request(BOOKMARKS).catch(() => hasBookmarksConsent());
  } catch {
    return hasBookmarksConsent();
  }
}

export const CONSENT_DENIED = () => tr('需要在 Firefox 中允许 Navill 传输书签数据');

/** 请求授权，未同意时抛错（给按钮处理函数用，放在第一个 await） */
export async function ensureBookmarksConsent(): Promise<void> {
  if (!(await requestBookmarksConsent())) throw new Error(CONSENT_DENIED());
}
