import en from './en.json';
import es from './es.json';
import pt from './pt.json';
import ru from './ru.json';
import ja from './ja.json';
import de from './de.json';
import fr from './fr.json';
import id from './id.json';

/**
 * 界面语言：中文（源文案）+ 各语言词典。
 * 文案直接以中文原文作 key：tr('同步方式') → 非中文时查对应词典，查不到回退英文，再回退中文。
 * 占位符写成 {0} {1}：tr('上次同步：{0}', time)。
 * 语言是本机设置：页面里同步读 localStorage（模块加载时就要确定，顶层常量也能翻译），
 * 后台 Service Worker 没有 localStorage，读 navigator.language（setLanguage 时同时写 chrome.storage.local 备用）。
 * 新增语言：加 xx.json（键与 en.json 一致，i18n.test.ts 会检查）、在 LANGS 登记、加 public/_locales/<locale>/messages.json。
 */
export const LANGS = {
  zh: { name: '中文', locale: 'zh-CN' },
  en: { name: 'English', locale: 'en-US' },
  es: { name: 'Español', locale: 'es' },
  pt: { name: 'Português (Brasil)', locale: 'pt-BR' },
  ru: { name: 'Русский', locale: 'ru' },
  ja: { name: '日本語', locale: 'ja' },
  de: { name: 'Deutsch', locale: 'de' },
  fr: { name: 'Français', locale: 'fr' },
  id: { name: 'Bahasa Indonesia', locale: 'id' },
} as const;
export type Lang = keyof typeof LANGS;
export type LangSetting = 'auto' | Lang;
const KEY = 'navill-lang';

const DICTS: Partial<Record<Lang, Record<string, string>>> = { en, es, pt, ru, ja, de, fr, id };
const isLang = (v: unknown): v is Lang => typeof v === 'string' && v in LANGS;

export function getLangSetting(): LangSetting {
  try {
    const v = globalThis.localStorage?.getItem(KEY);
    if (isLang(v)) return v;
  } catch { /* 无 localStorage */ }
  return 'auto';
}

/** 浏览器语言 → 界面语言（取主语言部分，没有对应词典时用英文） */
export function langFromLocale(nav: string): Lang {
  const base = nav.toLowerCase().split(/[-_]/)[0]!;
  if (base === 'zh') return 'zh';
  if (base === 'in') return 'id'; // 旧式印尼语代码
  return isLang(base) ? base : 'en';
}

function detect(): Lang {
  if (import.meta.env.MODE === 'test') return 'zh';
  const s = getLangSetting();
  if (s !== 'auto') return s;
  return langFromLocale(globalThis.navigator?.language ?? 'zh');
}

export const lang: Lang = detect();
const dict = DICTS[lang];
const fallback = en as Record<string, string>;

export function tr(key: string, ...args: (string | number)[]): string {
  const s = dict ? dict[key] ?? fallback[key] ?? key : key;
  return args.length ? s.replace(/\{(\d+)\}/g, (m, i) => (args[Number(i)] ?? m).toString()) : s;
}

/** 切换语言后刷新页面 */
export async function setLanguage(v: LangSetting) {
  if (v === 'auto') localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, v);
  await browser.storage.local.set({ [KEY]: v }).catch(() => {});
  location.reload();
}

/** 日期时间格式、排序用的 locale */
export const dateLocale: string = LANGS[lang].locale;

/** 某条文案在所有语言里的写法（含中文原文），用来识别用户没改过的预设名 */
export function translationsOf(key: string): string[] {
  return [key, ...Object.values(DICTS).map((d) => d?.[key]).filter((s): s is string => !!s)];
}
