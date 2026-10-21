import { useSyncExternalStore } from 'react';

import { tr } from '@/src/i18n';
import { LEGACY_COLORS } from './colors-legacy';
/** 预置颜色：light 用于浅色主题，dark 用于深色主题；数据里只存 light 值，显示时用 tone() 换成当前主题对应的颜色。 */
export interface PresetColor { name: string; light: string; dark: string }

/**
 * 色板：8 列 × 7 行。每列一个色相（红 橙 黄 绿 青 蓝 紫 灰），自上而下明度 0.83 → 0.35 等距 7 档。
 * 由 OKLCH 生成，彩度取该明度下 sRGB 能显示的上限的 85%（封顶 0.185），保证鲜明、档与档之间明显不同。
 * 浅色块上的文字/图标用 inkOn() 自动换成深色。名字取自中国传统色。
 */
export const COLOR_COLUMNS: PresetColor[][] = [
  [{ name: tr('海棠'), light: '#f7b4ab', dark: '#f7b4ac' }, { name: tr('杏红'), light: '#f48c81', dark: '#f59287' }, { name: tr('榴火'), light: '#f15d53', dark: '#f26a5f' }, { name: tr('春节红'), light: '#d5423b', dark: '#e14942' }, { name: tr('枫红'), light: '#b62a27', dark: '#c82f2c' }, { name: tr('祭红'), light: '#901f1d', dark: '#a72623' }, { name: tr('胭脂'), light: '#6c1513', dark: '#861c1a' }],
  [{ name: tr('驼色'), light: '#f7b888', dark: '#f7b888' }, { name: tr('桂子'), light: '#f4933d', dark: '#f49849' }, { name: tr('重阳菊'), light: '#d27d33', dark: '#db8235' }, { name: tr('丹柿'), light: '#b16929', dark: '#bd702d' }, { name: tr('赭石'), light: '#915520', dark: '#a15f24' }, { name: tr('琥珀'), light: '#734217', dark: '#854d1c' }, { name: tr('茶褐'), light: '#56300f', dark: '#6b3d15' }],
  [{ name: tr('中秋月'), light: '#e5c648', dark: '#e5c648' }, { name: tr('迎春'), light: '#c8ac3d', dark: '#ccb03f' }, { name: tr('腊梅'), light: '#ac9433', dark: '#b39a36' }, { name: tr('藤黄'), light: '#917c2a', dark: '#9a852d' }, { name: tr('银杏'), light: '#766520', dark: '#837025' }, { name: tr('稻黄'), light: '#5d4f17', dark: '#6c5c1d' }, { name: tr('秋香'), light: '#453a0f', dark: '#564915' }],
  [{ name: tr('豆绿'), light: '#6fe677', dark: '#6be774' }, { name: tr('柳色'), light: '#53cb5d', dark: '#52cf5e' }, { name: tr('嫩芽'), light: '#3ab047', dark: '#3db74a' }, { name: tr('荷叶'), light: '#2f943b', dark: '#339f3f' }, { name: tr('青团'), light: '#25792f', dark: '#2a8634' }, { name: tr('松青'), light: '#1b5f23', dark: '#216f2a' }, { name: tr('冬青'), light: '#124718', dark: '#195820' }],
  [{ name: tr('天青'), light: '#50e0df', dark: '#50e0e0' }, { name: tr('青瓷'), light: '#45c3c3', dark: '#46c7c7' }, { name: tr('薄荷'), light: '#3aa8a8', dark: '#3daeae' }, { name: tr('春水'), light: '#308d8d', dark: '#339797' }, { name: tr('石绿'), light: '#257373', dark: '#2a8080' }, { name: tr('孔雀蓝'), light: '#1b5a5a', dark: '#216969' }, { name: tr('竹青'), light: '#124343', dark: '#195454' }],
  [{ name: tr('冰蓝'), light: '#aac9f7', dark: '#abc9f7' }, { name: tr('晴山'), light: '#82b0f3', dark: '#87b3f4' }, { name: tr('碧空'), light: '#5795f0', dark: '#629cf1' }, { name: tr('琉璃'), light: '#2a79e8', dark: '#3983ed' }, { name: tr('石青'), light: '#2063c0', dark: '#246dd3' }, { name: tr('霁蓝'), light: '#174d98', dark: '#1c5ab0' }, { name: tr('黛蓝'), light: '#0e3873', dark: '#15478e' }],
  [{ name: tr('雪青'), light: '#ddb5f7', dark: '#ddb5f7' }, { name: tr('藕荷'), light: '#ce90f3', dark: '#d094f4' }, { name: tr('七夕紫'), light: '#bb6ee6', dark: '#c272ef' }, { name: tr('葡萄'), light: '#a154cb', dark: '#ab5cd7' }, { name: tr('青莲'), light: '#893bb1', dark: '#9546bf' }, { name: tr('钧紫'), light: '#702096', dark: '#802ea8' }, { name: tr('霜紫'), light: '#541671', dark: '#681d8c' }],
  [{ name: tr('银鼠'), light: '#c7c7c7', dark: '#c7c7c7' }, { name: tr('暖灰'), light: '#aeaeae', dark: '#b1b1b1' }, { name: tr('烟灰'), light: '#959595', dark: '#9b9b9b' }, { name: tr('岩灰'), light: '#7d7d7d', dark: '#868686' }, { name: tr('玄青'), light: '#666666', dark: '#717171' }, { name: tr('炭灰'), light: '#505050', dark: '#5d5d5d' }, { name: tr('墨'), light: '#3a3a3a', dark: '#4a4a4a' }],
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

/** 颜色上的文字/图标颜色：够深用白色，浅色块用深色 */
export function inkOn(hex: string | undefined): string {
  const m = hex && /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!m) return '#fff';
  const [r, g, b] = m.slice(1).map((x) => { const v = parseInt(x, 16) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }) as [number, number, number];
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.3 ? 'rgb(0 0 0 / 0.78)' : '#fff';
}
