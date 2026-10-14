import type { IconCache, NavillDB } from '@/src/db';
import { iconCandidatesFromHtml, iconCandidatesFromManifest, rankCandidates } from './pick';

/**
 * 高清网站图标：按域名抓取一次，缩到 64px WebP 存进 IndexedDB（每个约 2–4KB），只存本地不同步。
 * 来源顺序：网页自身的 apple-touch-icon / manifest / svg 图标（需要「访问所有网站」可选权限）
 *         → icon.horse → Google s2。都拿不到清晰图时回退浏览器自带 favicon。
 */
export const ICON_PX = 64;
const MIN_PX = 48; // 小于这个尺寸算不清晰
const TTL_OK = 30 * 864e5;
const TTL_FAIL = 7 * 864e5;
const TIMEOUT = 6000;

export const hostKey = (url: string) => {
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) ? u.hostname.replace(/^www\./, '') : null;
  } catch { return null; }
};

export const isFresh = (c: IconCache | undefined, now = Date.now()) =>
  !!c && now - c.fetchedAt < (c.failed ? TTL_FAIL : TTL_OK);

async function get(url: string, accept?: string): Promise<Response | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { signal: ctl.signal, credentials: 'omit', redirect: 'follow', headers: accept ? { accept } : undefined });
    return r.ok ? r : null;
  } catch { return null; } finally { clearTimeout(t); }
}

/** 解码任意格式（png/ico/svg/webp/jpg），返回原始尺寸与 64px WebP */
async function normalize(blob: Blob): Promise<{ px: number; out: Blob } | null> {
  if (!blob.type.startsWith('image/') && blob.type !== 'application/octet-stream' && blob.type !== '') return null;
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const svg = blob.type.includes('svg');
    const px = svg ? 512 : Math.min(img.naturalWidth, img.naturalHeight);
    if (!px) return null;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = ICON_PX;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    const w = svg ? ICON_PX : img.naturalWidth, h = svg ? ICON_PX : img.naturalHeight;
    const k = ICON_PX / Math.max(w, h);
    ctx.drawImage(img, (ICON_PX - w * k) / 2, (ICON_PX - h * k) / 2, w * k, h * k);
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.9));
    return out ? { px, out } : null;
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}

async function fromPage(host: string): Promise<Blob | null> {
  const origin = `https://${host}/`;
  if (!(await browser.permissions.contains({ origins: ['<all_urls>'] }).catch(() => false))) return null;
  const page = await get(origin, 'text/html');
  const list = [];
  if (page) {
    const { candidates, manifest } = iconCandidatesFromHtml(await page.text(), page.url || origin);
    list.push(...candidates);
    if (manifest) {
      const m = await get(manifest);
      if (m) list.push(...iconCandidatesFromManifest(await m.json().catch(() => null), manifest));
    }
  }
  list.push({ url: `${origin}apple-touch-icon.png`, size: 180, kind: 'apple' as const });
  for (const c of rankCandidates(list).slice(0, 4)) {
    const r = await get(c.url);
    const n = r && (await normalize(await r.blob()));
    if (n && n.px >= MIN_PX) return n.out;
  }
  return null;
}

async function fromIconHorse(host: string): Promise<Blob | null> {
  const r = await get(`https://icon.horse/icon/${host}`);
  // 找不到图标时 icon.horse 返回生成的字母占位图（CDN 只缓存 5 分钟），视为没有
  if (!r || /s-maxage=300\b/.test(r.headers.get('cache-control') ?? '')) return null;
  const n = await normalize(await r.blob());
  return n && n.px >= MIN_PX ? n.out : null;
}

async function fromGoogle(host: string): Promise<Blob | null> {
  const r = await get(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`); // 找不到时是 404
  const n = r && (await normalize(await r.blob()));
  return n && n.px >= MIN_PX ? n.out : null;
}

export async function fetchIcon(db: NavillDB, host: string): Promise<void> {
  const sources = [['page', fromPage], ['icon.horse', fromIconHorse], ['google', fromGoogle]] as const;
  for (const [source, fn] of sources) {
    const blob = await fn(host).catch(() => null);
    if (blob) {
      await db.icons.put({ host, blob, source, fetchedAt: Date.now() });
      return;
    }
  }
  await db.icons.put({ host, fetchedAt: Date.now(), failed: true });
}

// 简单队列：同时最多 4 个请求，同一域名只排一次
const queued = new Set<string>();
const waiting: string[] = [];
let running = 0;
let queueDb: NavillDB | null = null;
function pump() {
  while (queueDb && running < 4 && waiting.length) {
    const host = waiting.shift()!;
    running++;
    void fetchIcon(queueDb, host).finally(() => { running--; queued.delete(host); pump(); });
  }
}
export function requestIcon(db: NavillDB, host: string) {
  if (queued.has(host)) return;
  queued.add(host);
  queueDb = db;
  waiting.push(host);
  pump();
}

/** 清空缓存（设置里「重新获取图标」），返回清掉的条数 */
export async function clearIconCache(db: NavillDB) {
  const n = await db.icons.count();
  await db.icons.clear();
  return n;
}
