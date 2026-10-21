import { useSyncExternalStore } from 'react';

import { tr } from '@/src/i18n';
import { LEGACY_COLORS } from './colors-legacy';
/** 预置颜色：light 用于浅色主题，dark 用于深色主题；数据里只存 light 值，显示时用 tone() 换成当前主题对应的颜色。 */
export interface PresetColor { name: string; light: string; dark: string }

/**
 * 色板：按色相排成 13 列（12 个色相 + 灰），每列 4 种由浅到深（柔和 / 鲜明 / 灰调 / 深沉），共 52 色。
 * 由 OKLCH 生成（固定明度与彩度档位，保证同一行观感一致、都能承载白色文字），名字取自中国传统色。
 */
export const COLOR_COLUMNS: PresetColor[][] = [
  [{ name: tr('海棠'), light: '#c17e78', dark: '#ce938e' }, { name: tr('榴火'), light: '#ca5551', dark: '#d5706a' }, { name: tr('豆沙'), light: '#87615d', dark: '#957471' }, { name: tr('祭红'), light: '#9c433f', dark: '#a85b56' }],
  [{ name: tr('杏红'), light: '#be8266', dark: '#cc977f' }, { name: tr('朱砂'), light: '#c65d26', dark: '#d1774c' }, { name: tr('檀色'), light: '#856354', dark: '#947669' }, { name: tr('赭石'), light: '#994920', dark: '#a5603f' }],
  [{ name: tr('驼色'), light: '#b58858', dark: '#c39c73' }, { name: tr('桂子'), light: '#b26f06', dark: '#c5812c' }, { name: tr('古铜'), light: '#7f674c', dark: '#8f7962' }, { name: tr('琥珀'), light: '#8b5505', dark: '#9b6829' }],
  [{ name: tr('中秋月'), light: '#a59153', dark: '#b5a470' }, { name: tr('藤黄'), light: '#9a7d03', dark: '#ae8f1c' }, { name: tr('秋香'), light: '#766b4a', dark: '#867d61' }, { name: tr('稻黄'), light: '#786107', dark: '#8a7220' }],
  [{ name: tr('柳色'), light: '#869c61', dark: '#9aad7b' }, { name: tr('嫩芽'), light: '#6c8e03', dark: '#809f41' }, { name: tr('苔绿'), light: '#657151', dark: '#778266' }, { name: tr('端午艾'), light: '#546e0d', dark: '#677f37' }],
  [{ name: tr('豆绿'), light: '#6ca177', dark: '#84b28d' }, { name: tr('荷叶'), light: '#25984d', dark: '#51a867' }, { name: tr('冬青'), light: '#57745d', dark: '#6c8570' }, { name: tr('松青'), light: '#21763c', dark: '#448554' }],
  [{ name: tr('青瓷'), light: '#54a38f', dark: '#72b4a2' }, { name: tr('薄荷'), light: '#11957c', dark: '#07aa8e' }, { name: tr('竹青'), light: '#4c766a', dark: '#63867c' }, { name: tr('石绿'), light: '#097460', dark: '#118871' }],
  [{ name: tr('天青'), light: '#49a1ab', dark: '#6bb2ba' }, { name: tr('春水'), light: '#03919d', dark: '#09a5b3' }, { name: tr('寒烟'), light: '#48747a', dark: '#5f8589' }, { name: tr('孔雀蓝'), light: '#06717a', dark: '#09848f' }],
  [{ name: tr('冰蓝'), light: '#6099c1', dark: '#7babce' }, { name: tr('碧空'), light: '#0f89c7', dark: '#389bd8' }, { name: tr('远山'), light: '#517086', dark: '#678194' }, { name: tr('石青'), light: '#086a9c', dark: '#327caa' }],
  [{ name: tr('晴山'), light: '#7e90c7', dark: '#93a3d3' }, { name: tr('琉璃'), light: '#5e78d9', dark: '#748de0' }, { name: tr('黛蓝'), light: '#606b89', dark: '#737d97' }, { name: tr('霁蓝'), light: '#495da7', dark: '#5d71b0' }],
  [{ name: tr('雪青'), light: '#9e85bc', dark: '#af9ac9' }, { name: tr('葡萄'), light: '#9565c7', dark: '#a47dd0' }, { name: tr('霜紫'), light: '#726583', dark: '#837792' }, { name: tr('青莲'), light: '#734f99', dark: '#8264a4' }],
  [{ name: tr('荷花'), light: '#ba7d99', dark: '#c892ab' }, { name: tr('桃夭'), light: '#c0558d', dark: '#cb6f9d' }, { name: tr('藕荷'), light: '#836070', dark: '#927381' }, { name: tr('胭脂'), light: '#94436d', dark: '#a15a7d' }],
  [{ name: tr('银鼠'), light: '#8f9296', dark: '#a2a5a8' }, { name: tr('烟灰'), light: '#757b80', dark: '#878d92' }, { name: tr('玄青'), light: '#5e636f', dark: '#6f7581' }, { name: tr('墨'), light: '#4a4d52', dark: '#5b5e62' }],
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
