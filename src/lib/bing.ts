import { storage } from 'wxt/utils/storage';

/** Bing 每日图片：每天取一次，缓存在本机 */
/** base 为不带尺寸后缀的图片地址，按屏幕选 1920x1080（约 300 KB）或 UHD（约 3.5 MB） */
export interface BingImage { day: string; base: string; title: string; copyright: string; link?: string }

export const BING_ORIGIN = 'https://www.bing.com/*';
const cache = storage.defineItem<BingImage | null>('local:bingImage', { fallback: null });

const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD，本地日期

export function bingMarket(lang = navigator.language) {
  return /^zh/i.test(lang) ? 'zh-CN' : 'en-US';
}

/** 屏幕物理宽度超过 1920 才用 UHD，否则 1920x1080 */
export function bingUrl(img: BingImage, width = screen.width * devicePixelRatio) {
  return `${img.base}_${width > 1920 ? 'UHD' : '1920x1080'}.jpg`;
}

/** 解析 HPImageArchive 接口返回 */
export function parseBing(json: unknown, day: string): BingImage | null {
  const img = (json as { images?: { urlbase?: string; url?: string; title?: string; copyright?: string; copyrightlink?: string }[] })?.images?.[0];
  if (!img?.urlbase) return null;
  return { day, base: new URL(img.urlbase, 'https://www.bing.com').href, title: img.title ?? '', copyright: img.copyright ?? '', link: img.copyrightlink };
}

export async function hasBingPermission() {
  return browser.permissions.contains({ origins: [BING_ORIGIN] });
}

/** 申请访问 bing.com（需在用户点击中调用） */
export async function requestBingPermission() {
  return browser.permissions.request({ origins: [BING_ORIGIN] });
}

export async function getBingImage(): Promise<BingImage | null> {
  const day = today();
  const hit = await cache.getValue();
  if (hit?.day === day && hit.base) return hit;
  try {
    if (!(await hasBingPermission())) return hit;
    const r = await fetch(`https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=${bingMarket()}`);
    if (!r.ok) return hit;
    const img = parseBing(await r.json(), day);
    if (img) await cache.setValue(img);
    return img ?? hit;
  } catch {
    return hit?.base ? hit : null; // 离线或接口变动：沿用上一张
  }
}

const CACHE = 'navill-bing';
/**
 * 取图片的本地副本（Cache Storage）：第一次下载后存起来，之后打开新标签页直接从本机读，不用再等网络。
 * 只保留当前这一张；读不到时返回网络地址。
 */
export async function cachedImageUrl(url: string): Promise<string> {
  try {
    const cache = await caches.open(CACHE);
    let res = await cache.match(url);
    if (!res) {
      const net = await fetch(url);
      if (!net.ok) return url;
      for (const k of await cache.keys()) await cache.delete(k);
      await cache.put(url, net.clone());
      res = net;
    }
    return URL.createObjectURL(await res.blob());
  } catch {
    return url;
  }
}
