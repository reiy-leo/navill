import en from './en.json';

/**
 * 界面语言：中文（源文案）/ English。
 * 文案直接以中文原文作 key：tr('同步方式') → 英文模式下查 en.json，查不到时回退中文。
 * 占位符写成 {0} {1}：tr('上次同步：{0}', time)。
 * 语言是本机设置：页面里同步读 localStorage（模块加载时就要确定，顶层常量也能翻译），
 * 后台 Service Worker 没有 localStorage，读 navigator.language（setLanguage 时同时写 chrome.storage.local 备用）。
 */
export type Lang = 'zh' | 'en';
export type LangSetting = 'auto' | Lang;
const KEY = 'navill-lang';

export function getLangSetting(): LangSetting {
  try {
    const v = globalThis.localStorage?.getItem(KEY);
    if (v === 'zh' || v === 'en') return v;
  } catch { /* 无 localStorage */ }
  return 'auto';
}

function detect(): Lang {
  if (import.meta.env.MODE === 'test') return 'zh';
  const s = getLangSetting();
  if (s !== 'auto') return s;
  const nav = globalThis.navigator?.language ?? 'zh';
  return /^zh/i.test(nav) ? 'zh' : 'en';
}

export const lang: Lang = detect();
const dict = en as Record<string, string>;

export function tr(key: string, ...args: (string | number)[]): string {
  const s = lang === 'en' ? dict[key] ?? key : key;
  return args.length ? s.replace(/\{(\d+)\}/g, (m, i) => (args[Number(i)] ?? m).toString()) : s;
}

/** 切换语言后刷新页面 */
export async function setLanguage(v: LangSetting) {
  if (v === 'auto') localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, v);
  await browser.storage.local.set({ [KEY]: v }).catch(() => {});
  location.reload();
}

/** 日期时间格式用的 locale */
export const dateLocale = lang === 'en' ? 'en-US' : 'zh-CN';
