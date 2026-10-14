import { storage } from 'wxt/utils/storage';

/**
 * Google OAuth：chrome.identity.launchWebAuthFlow（Chrome / Edge 通用），仅 drive.appdata scope。
 * 客户端 ID 构建时注入：.env 中 WXT_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
 * Google Cloud 里为 Chrome 和 Edge 的扩展 ID 各登记一个回调：https://<extension-id>.chromiumapp.org/
 */
export const CLIENT_ID: string = import.meta.env.WXT_GOOGLE_CLIENT_ID ?? '';
export const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

interface Token { accessToken: string; expiresAt: number }
const tokenItem = storage.defineItem<Token | null>('session:driveToken', { fallback: null });
const signedInItem = storage.defineItem<boolean>('local:driveSignedIn', { fallback: false });

export const isConfigured = () => Boolean(CLIENT_ID);
export const isSignedIn = () => signedInItem.getValue();
export const redirectUri = () => browser.identity.getRedirectURL();

async function launch(interactive: boolean): Promise<Token> {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('redirect_uri', redirectUri());
  url.searchParams.set('scope', SCOPE);
  if (!interactive) url.searchParams.set('prompt', 'none');
  const result = await browser.identity.launchWebAuthFlow({ url: url.toString(), interactive });
  if (!result) throw new Error('授权已取消');
  const params = new URLSearchParams(new URL(result).hash.slice(1));
  const err = params.get('error');
  if (err) throw new Error(`Google 授权失败：${err}`);
  const accessToken = params.get('access_token');
  if (!accessToken) throw new Error('Google 授权失败：没有拿到令牌');
  const token = { accessToken, expiresAt: Date.now() + (Number(params.get('expires_in')) || 3600) * 1000 - 60_000 };
  await tokenItem.setValue(token);
  return token;
}

/** 取可用令牌：缓存 → 静默续期（prompt=none）→ interactive 时弹窗 */
export async function getToken(interactive = false): Promise<string> {
  if (!isConfigured()) throw new Error('未配置 Google OAuth 客户端 ID');
  const cached = await tokenItem.getValue();
  if (cached && cached.expiresAt > Date.now()) return cached.accessToken;
  if (!(await isSignedIn()) && !interactive) throw new Error('未登录 Google');
  try {
    return (await launch(false)).accessToken;
  } catch (e) {
    if (!interactive) throw e;
    return (await launch(true)).accessToken;
  }
}

export async function signIn(): Promise<void> {
  await launch(true);
  await signedInItem.setValue(true);
}

export async function signOut(): Promise<void> {
  const t = await tokenItem.getValue();
  if (t) await fetch(`https://oauth2.googleapis.com/revoke?token=${t.accessToken}`, { method: 'POST' }).catch(() => {});
  await tokenItem.setValue(null);
  await signedInItem.setValue(false);
}

export async function invalidateToken() {
  await tokenItem.setValue(null);
}
