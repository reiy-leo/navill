import { storage } from 'wxt/utils/storage';
import { HttpError } from './http';
import type { RemoteFile } from './backend';

import { tr } from '@/src/i18n';
/**
 * 通用 WebDAV 客户端（坚果云、Nextcloud、群晖、Alist 等）。
 * 所有数据放在服务器根目录下的 navill-bookmarks/ 中，目录自动创建。
 * 凭据只存本机（local storage，不参与设置同步）。
 */
export const WEBDAV_DIR = 'navill-bookmarks/';
const SUBDIRS = ['events/', 'logs/'];

export interface WebdavConfig { url: string; username: string; password: string }
export const webdavConfigItem = storage.defineItem<WebdavConfig | null>('local:webdavConfig', { fallback: null });

/** 规范化服务器地址：补 https://、去掉末尾斜杠后再加一个 */
export function normalizeUrl(input: string): string {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  const url = new URL(u);
  return url.origin + url.pathname.replace(/\/+$/, '') + '/';
}

/** 授权本扩展访问该服务器（optional_host_permissions），需在用户点击时调用 */
export const originPattern = (url: string) => `${new URL(url).origin}/*`;

const utf8b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const encodePath = (name: string) => name.split('/').map(encodeURIComponent).join('/');

async function req(cfg: WebdavConfig, path: string, init: RequestInit & { ok?: number[] } = {}): Promise<Response> {
  const res = await fetch(cfg.url + path, {
    ...init,
    cache: 'no-store',
    headers: { Authorization: `Basic ${utf8b64(`${cfg.username}:${cfg.password}`)}`, ...(init.headers ?? {}) },
  });
  if (!res.ok && !init.ok?.includes(res.status)) {
    if (res.status === 401) throw new HttpError(401, tr('用户名或应用密码不对'));
    throw new HttpError(res.status);
  }
  return res;
}

const PROPFIND_BODY = '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:getetag/><d:getlastmodified/><d:resourcetype/></d:prop></d:propfind>';

interface Entry { path: string; etag?: string; modified?: string; dir: boolean }

/** 解析 multistatus（后台 Service Worker 里没有 DOMParser，用正则，兼容任意命名空间前缀） */
export function parseMultistatus(xml: string, base: string): Entry[] {
  const tag = (name: string, s: string) => s.match(new RegExp(`<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, 'i'))?.[1]?.trim();
  const out: Entry[] = [];
  for (const block of xml.split(/<(?:[\w-]+:)?response[\s>]/i).slice(1)) {
    const href = tag('href', block);
    if (!href) continue;
    const path = decodeURIComponent(new URL(href.replace(/&amp;/g, '&'), base).pathname);
    const etag = quoteEtag(tag('getetag', block)?.replace(/&quot;/g, '"'));
    const modified = tag('getlastmodified', block);
    const dir = /<(?:[\w-]+:)?collection\s*\/?>/i.test(block);
    out.push({ path, etag, modified, dir });
  }
  return out;
}

/** 有些服务器 PROPFIND 返回的 ETag 不带引号，If-Match 需要带引号的形式 */
const quoteEtag = (e?: string | null) => (!e ? undefined : /^(W\/)?"/.test(e) ? e : `"${e}"`);

async function propfind(cfg: WebdavConfig, path: string, depth: '0' | '1', ok: number[] = []): Promise<Response> {
  return req(cfg, path, { method: 'PROPFIND', headers: { Depth: depth, 'Content-Type': 'application/xml; charset=utf-8' }, body: PROPFIND_BODY, ok });
}

export async function getConfig(): Promise<WebdavConfig> {
  const cfg = await webdavConfigItem.getValue();
  if (!cfg) throw new Error(tr('未连接 WebDAV'));
  return cfg;
}

let ensured = '';
/** 创建 navill-bookmarks/ 及子目录（已存在时 MKCOL 返回 405，忽略） */
async function ensureDirs(cfg: WebdavConfig) {
  const key = cfg.url + cfg.username;
  if (ensured === key) return;
  for (const d of ['', ...SUBDIRS]) await req(cfg, encodePath(WEBDAV_DIR + d), { method: 'MKCOL', ok: [405, 409] });
  ensured = key;
}

/** 测试连接：验证账号并创建目录 */
export async function testConnection(cfg: WebdavConfig): Promise<void> {
  await propfind(cfg, '', '0');
  ensured = '';
  await ensureDirs(cfg);
}

export async function listFiles(): Promise<RemoteFile[]> {
  const cfg = await getConfig();
  await ensureDirs(cfg);
  const basePath = decodeURIComponent(new URL(cfg.url + WEBDAV_DIR).pathname);
  const out: RemoteFile[] = [];
  for (const d of ['', ...SUBDIRS]) {
    const res = await propfind(cfg, encodePath(WEBDAV_DIR + d), '1', [404]);
    if (res.status === 404) continue;
    for (const e of parseMultistatus(await res.text(), cfg.url)) {
      if (e.dir || !e.path.startsWith(basePath)) continue;
      const name = e.path.slice(basePath.length);
      if (!name || out.some((f) => f.name === name)) continue;
      out.push({ id: name, name, modifiedTime: e.etag || e.modified || '', etag: e.etag });
    }
  }
  return out;
}

export async function download(file: RemoteFile): Promise<ArrayBuffer> {
  const cfg = await getConfig();
  return (await req(cfg, encodePath(WEBDAV_DIR + file.name))).arrayBuffer();
}

/** 上传：有 ETag 时用 If-Match，防止两台设备同时写覆盖对方（冲突时返回 412，下一轮重新合并） */
export async function upload(name: string, body: Blob, existing?: RemoteFile): Promise<RemoteFile> {
  const cfg = await getConfig();
  await ensureDirs(cfg);
  const path = encodePath(WEBDAV_DIR + name);
  const headers: Record<string, string> = { 'Content-Type': 'application/gzip' };
  if (existing?.etag) headers['If-Match'] = existing.etag;
  const res = await req(cfg, path, { method: 'PUT', headers, body });
  let etag = quoteEtag(res.headers.get('ETag'));
  let modified: string | undefined;
  if (!etag) {
    const p = await propfind(cfg, path, '0');
    const e = parseMultistatus(await p.text(), cfg.url)[0];
    etag = e?.etag;
    modified = e?.modified;
  }
  return { id: name, name, modifiedTime: etag || modified || String(Date.now()), etag };
}

export async function remove(file: RemoteFile): Promise<void> {
  const cfg = await getConfig();
  await req(cfg, encodePath(WEBDAV_DIR + file.name), { method: 'DELETE', ok: [404] });
}
