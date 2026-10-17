import { storage } from 'wxt/utils/storage';

/** Bing 每日图片：每天取一次，缓存在本机 */
export interface BingImage { day: string; url: string; title: string; copyright: string; link?: string }

export const BING_ORIGIN = 'https://www.bing.com/*';
const cache = storage.defineItem<BingImage | null>('local:bingImage', { fallback: null });

const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD，本地日期

export function bingMarket(lang = navigator.language) {
  return /^zh/i.test(lang) ? 'zh-CN' : 'en-US';
}

/** 解析 HPImageArchive 接口返回，取 UHD 原图 */
export function parseBing(json: unknown, day: string): BingImage | null {
  const img = (json as { images?: { urlbase?: string; url?: string; title?: string; copyright?: string; copyrightlink?: string }[] })?.images?.[0];
  if (!img?.urlbase && !img?.url) return null;
  const path = img.urlbase ? `${img.urlbase}_UHD.jpg` : img.url!;
  return { day, url: new URL(path, 'https://www.bing.com').href, title: img.title ?? '', copyright: img.copyright ?? '', link: img.copyrightlink };
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
  if (hit?.day === day) return hit;
  try {
    if (!(await hasBingPermission())) return hit;
    const r = await fetch(`https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=${bingMarket()}`);
    if (!r.ok) return hit;
    const img = parseBing(await r.json(), day);
    if (img) await cache.setValue(img);
    return img ?? hit;
  } catch {
    return hit; // 离线或接口变动：沿用上一张
  }
}
