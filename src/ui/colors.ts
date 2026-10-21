import { useSyncExternalStore } from 'react';

import { tr } from '@/src/i18n';
import { LEGACY_COLORS } from './colors-legacy';
/** 预置颜色：light 用于浅色主题，dark 用于深色主题；数据里只存 light 值，显示时用 tone() 换成当前主题对应的颜色。 */
export interface PresetColor { name: string; light: string; dark: string }

/**
 * 色板：8 列 × 7 行。每列一个色相（红 橙 黄 绿 青 蓝 紫 灰），自上而下由浅到深 7 档。
 * 由 OKLCH 生成（同一行明度一致、彩度两头低中间高），都能承载白色文字；名字取自中国传统色。
 */
export const COLOR_COLUMNS: PresetColor[][] = [
  [{ name: tr('海棠'), light: '#bf837e', dark: '#cd9994' }, { name: tr('杏红'), light: '#bd6f69', dark: '#ca8680' }, { name: tr('榴火'), light: '#bc5853', dark: '#c8716b' }, { name: tr('春节红'), light: '#b44542', dark: '#bf605a' }, { name: tr('枫红'), light: '#a13c39', dark: '#ad5651' }, { name: tr('祭红'), light: '#8b3835', dark: '#984f4a' }, { name: tr('胭脂'), light: '#743531', dark: '#814a45' }],
  [{ name: tr('驼色'), light: '#ba8969', dark: '#c89e82' }, { name: tr('桂子'), light: '#b7774a', dark: '#c48c67' }, { name: tr('重阳菊'), light: '#b56320', dark: '#c17a47' }, { name: tr('丹柿'), light: '#a85603', dark: '#b86a2e' }, { name: tr('赭石'), light: '#964c01', dark: '#a65f28' }, { name: tr('琥珀'), light: '#844203', dark: '#92572b' }, { name: tr('茶褐'), light: '#6f3c12', dark: '#7c4f2f' }],
  [{ name: tr('中秋月'), light: '#a6945f', dark: '#b6a77a' }, { name: tr('迎春'), light: '#9e863a', dark: '#ad995b' }, { name: tr('腊梅'), light: '#957806', dark: '#a58b32' }, { name: tr('藤黄'), light: '#866c06', dark: '#9a7d0f' }, { name: tr('银杏'), light: '#776008', dark: '#8b710c' }, { name: tr('稻黄'), light: '#695405', dark: '#7c6514' }, { name: tr('秋香'), light: '#5b4904', dark: '#6b5a23' }],
  [{ name: tr('豆绿'), light: '#7da175', dark: '#93b28c' }, { name: tr('柳色'), light: '#67975c', dark: '#7ea875' }, { name: tr('嫩芽'), light: '#4e8e3f', dark: '#689e5c' }, { name: tr('荷叶'), light: '#398227', dark: '#569248' }, { name: tr('青团'), light: '#327421', dark: '#4d8441' }, { name: tr('松青'), light: '#2f6522', dark: '#47753d' }, { name: tr('冬青'), light: '#2e5625', dark: '#44663c' }],
  [{ name: tr('天青'), light: '#5aa49f', dark: '#78b5b0' }, { name: tr('青瓷'), light: '#249b96', dark: '#54aba6' }, { name: tr('薄荷'), light: '#108e88', dark: '#05a29c' }, { name: tr('春水'), light: '#02807b', dark: '#03948e' }, { name: tr('石绿'), light: '#0d716d', dark: '#098580' }, { name: tr('孔雀蓝'), light: '#0d6460', dark: '#0f7772' }, { name: tr('竹青'), light: '#035753', dark: '#126965' }],
  [{ name: tr('冰蓝'), light: '#7698c3', dark: '#8daad0' }, { name: tr('晴山'), light: '#5e8bc4', dark: '#769dcf' }, { name: tr('碧空'), light: '#417dc7', dark: '#5d90cf' }, { name: tr('琉璃'), light: '#2a6fc1', dark: '#4a82c8' }, { name: tr('石青'), light: '#2363ad', dark: '#4275b6' }, { name: tr('霁蓝'), light: '#245795', dark: '#3f699f' }, { name: tr('黛蓝'), light: '#264c7b', dark: '#3d5d86' }],
  [{ name: tr('雪青'), light: '#a389b8', dark: '#b49dc6' }, { name: tr('藕荷'), light: '#9b77b6', dark: '#ab8cc2' }, { name: tr('七夕紫'), light: '#9363b5', dark: '#a27ac0' }, { name: tr('葡萄'), light: '#8953ad', dark: '#976ab7' }, { name: tr('青莲'), light: '#7a499b', dark: '#885fa6' }, { name: tr('钧紫'), light: '#6a4286', dark: '#795791' }, { name: tr('霜紫'), light: '#5a3c6f', dark: '#694f7c' }],
  [{ name: tr('银鼠'), light: '#92959a', dark: '#a4a8ad' }, { name: tr('暖灰'), light: '#85898d', dark: '#979b9f' }, { name: tr('烟灰'), light: '#787c80', dark: '#8a8e92' }, { name: tr('岩灰'), light: '#6c6f74', dark: '#7d8185' }, { name: tr('玄青'), light: '#606367', dark: '#717479' }, { name: tr('炭灰'), light: '#54575b', dark: '#64686c' }, { name: tr('墨'), light: '#484b4f', dark: '#585c60' }],
];

export const PRESET_COLORS: PresetColor[] = COLOR_COLUMNS.flat();
const BY_LIGHT = new Map([...LEGACY_COLORS, ...PRESET_COLORS].map((c) => [c.light.toLowerCase(), c]));

export const presetOf = (hex?: string) => (hex ? BY_LIGHT.get(hex.toLowerCase()) : undefined);

/** 非预置颜色（旧数据）在深色主题下按 HSL 略提亮、降饱和 */
function darken(hex: string): string {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  }
  const s2 = s * 0.85, l2 = Math.min(0.72, l + 0.07);
  const k = (n: number) => (n + h / 30) % 12;
  const a = s2 * Math.min(l2, 1 - l2);
  const f = (n: number) => Math.round((l2 - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))) * 255).toString(16).padStart(2, '0');
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** 当前主题下实际显示的颜色 */
export function tone(hex: string | undefined, dark: boolean): string | undefined {
  if (!hex || !dark) return hex;
  return presetOf(hex)?.dark ?? darken(hex);
}

const subscribe = (cb: () => void) => {
  const o = new MutationObserver(cb);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
  return () => o.disconnect();
};
const isDark = () => document.documentElement.dataset.mode === 'dark';

/** 是否深色主题（随 <html data-mode> 变化） */
export const useDarkMode = () => useSyncExternalStore(subscribe, isDark, () => false);

/** 颜色随主题切换 */
export function useTone(hex: string | undefined): string | undefined {
  return tone(hex, useDarkMode());
}

const RECENT_KEY = 'nv-recent-colors';
/** 最近使用的颜色（本机，最多 6 个，新的在前） */
export function recentColors(): string[] {
  try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 6) : []; } catch { return []; }
}
export function pushRecentColor(hex: string) {
  const h = hex.toLowerCase();
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([h, ...recentColors().filter((x) => x !== h)].slice(0, 6))); } catch { /* ignore */ }
}
