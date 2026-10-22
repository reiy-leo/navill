import { storage } from 'wxt/utils/storage';
import { syncStatusItem } from '../settings';

import { tr } from '@/src/i18n';
/**
 * Google OAuth：chrome.identity.launchWebAuthFlow（Chrome / Edge 通用），仅 drive.appdata scope。
 * 客户端 ID 默认用内置的正式 ID；自建 fork 可在 .env 中用 WXT_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com 覆盖
 * Google Cloud 里为 Chrome 和 Edge 的扩展 ID 各登记一个回调：https://<extension-id>.chromiumapp.org/；
 * Firefox 的回调是 https://<hash>.extensions.allizom.org/（由附加组件 ID 推出，同样要登记）
 */
/** 正式扩展的 OAuth 客户端 ID。客户端 ID 是公开信息（会出现在授权地址里），直接写进代码，CI 打包无需额外配置。 */
const DEFAULT_CLIENT_ID = '71336458400-odpqtecn9rhrqp913lmpka5r8mk2r0fg.apps.googleusercontent.com';
export const CLIENT_ID: string = import.meta.env.WXT_GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID;
export const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

interface Token { accessToken: string; expiresAt: number }
const tokenItem = storage.defineItem<Token | null>('session:driveToken', { fallback: null });
const signedInItem = storage.defineItem<boolean>('local:driveSignedIn', { fallback: false });

export const isConfigured = () => Boolean(CLIENT_ID);
export const isSignedIn = () => signedInItem.getValue();
export const redirectUri = () => browser.identity.getRedirectURL();

/** 分享需要邮箱身份：增量申请 openid email，令牌单独缓存 */
export const SHARE_SCOPE = `openid email profile ${'https://www.googleapis.com/auth/drive.appdata'}`;
const shareTokenItem = storage.defineItem<Token | null>('session:shareToken', { fallback: null });

async function launch(interactive: boolean, scope = SCOPE, item = tokenItem): Promise<Token> {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('redirect_uri', redirectUri());
  url.searchParams.set('scope', scope);
  url.searchParams.set('include_granted_scopes', 'true');
  if (!interactive) url.searchParams.set('prompt', 'none');
  const result = await browser.identity.launchWebAuthFlow({ url: url.toString(), interactive });
  if (!result) throw new Error(tr('授权已取消'));
  const params = new URLSearchParams(new URL(result).hash.slice(1));
  const err = params.get('error');
  if (err) throw new Error(tr('Google 授权失败：{0}', err));
  const accessToken = params.get('access_token');
  if (!accessToken) throw new Error(tr('Google 授权失败：没有拿到令牌'));
  const token = { accessToken, expiresAt: Date.now() + (Number(params.get('expires_in')) || 3600) * 1000 - 60_000 };
  await item.setValue(token);
  return token;
}

/** 取可用令牌：缓存 → 静默续期（prompt=none）→ interactive 时弹窗 */
export async function getToken(interactive = false): Promise<string> {
  if (!isConfigured()) throw new Error(tr('未配置 Google OAuth 客户端 ID'));
  const cached = await tokenItem.getValue();
  if (cached && cached.expiresAt > Date.now()) return cached.accessToken;
  if (!(await isSignedIn()) && !interactive) throw new Error(tr('未登录 Google'));
  try {
    return (await launch(false)).accessToken;
  } catch (e) {
    if (!interactive) throw e;
    return (await launch(true)).accessToken;
  }
}

/** 分享用令牌（含 email scope）：缓存 → 静默 → 弹窗 */
export async function getShareToken(interactive = true): Promise<string> {
  if (!isConfigured()) throw new Error(tr('未配置 Google OAuth 客户端 ID'));
  const cached = await shareTokenItem.getValue();
  if (cached && cached.expiresAt > Date.now()) return cached.accessToken;
  try {
    return (await launch(false, SHARE_SCOPE, shareTokenItem)).accessToken;
  } catch (e) {
    if (!interactive) throw e;
    return (await launch(true, SHARE_SCOPE, shareTokenItem)).accessToken;
  }
}
export const invalidateShareToken = () => shareTokenItem.setValue(null);

export interface GoogleUser { email: string; name?: string; picture?: string }
/** 分享所用的 Google 账号（用分享令牌读 userinfo，不弹窗） */
export async function getShareUser(): Promise<GoogleUser | null> {
  try {
    const token = await getShareToken(false);
    const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const u = await res.json();
    return u?.email ? { email: u.email, name: u.name, picture: u.picture } : null;
  } catch {
    return null;
  }
}

export async function signIn(): Promise<void> {
  await launch(true);
  await signedInItem.setValue(true);
  if ((await syncStatusItem.getValue()).state === 'signed-out') await syncStatusItem.setValue({ state: 'idle' });
}

export async function signOut(): Promise<void> {
  const t = await tokenItem.getValue();
  if (t) await fetch(`https://oauth2.googleapis.com/revoke?token=${t.accessToken}`, { method: 'POST' }).catch(() => {});
  await tokenItem.setValue(null);
  await shareTokenItem.setValue(null);
  await signedInItem.setValue(false);
  await syncStatusItem.setValue({ state: 'signed-out' });
}

export async function invalidateToken() {
  await tokenItem.setValue(null);
}
