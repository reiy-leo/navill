import { useSyncExternalStore } from 'react';

/**
 * 预置颜色：8 类 × 8 种 = 64 色，按节气四季、节日、矿石、器物、中性分类，名字取自中国传统色。
 * 每种是一对：light 用于浅色主题，dark 用于深色主题（略提亮、降饱和），两者都能承载白色文字。
 * 数据里只存 light 值（兼容旧数据与同步），显示时用 tone() 换成当前主题对应的颜色。
 */
export interface PresetColor { name: string; light: string; dark: string }
export interface ColorGroup { name: string; colors: PresetColor[] }

export const COLOR_GROUPS: ColorGroup[] = [
  { name: '春', colors: [
    { name: '迎春', light: '#b39609', dark: '#c7ad42' },
    { name: '嫩芽', light: '#779b1e', dark: '#8faf51' },
    { name: '柳色', light: '#58994a', dark: '#76ac6a' },
    { name: '青团', light: '#438c60', dark: '#639f78' },
    { name: '春水', light: '#1d9999', dark: '#53acac' },
    { name: '桃夭', light: '#d2678c', dark: '#e184a1' },
    { name: '杏红', light: '#d3694f', dark: '#e1856e' },
    { name: '樱草', light: '#c38824', dark: '#d4a056' },
  ] },
  { name: '夏', colors: [
    { name: '荷叶', light: '#409156', dark: '#62a471' },
    { name: '荷花', light: '#ca5e96', dark: '#d97caa' },
    { name: '榴火', light: '#da4339', dark: '#e7685b' },
    { name: '碧空', light: '#248fcc', dark: '#54a4d9' },
    { name: '湖蓝', light: '#0e8ba8', dark: '#38a0bd' },
    { name: '薄荷', light: '#33a182', dark: '#5fb599' },
    { name: '葡萄', light: '#8b5fb9', dark: '#9d78c6' },
    { name: '芒种', light: '#bb8d0c', dark: '#d0a43e' },
  ] },
  { name: '秋', colors: [
    { name: '枫红', light: '#cf4040', dark: '#dd645e' },
    { name: '丹柿', light: '#dc631e', dark: '#ea814f' },
    { name: '银杏', light: '#b28d0e', dark: '#c7a33a' },
    { name: '稻黄', light: '#b5820c', dark: '#c6994a' },
    { name: '桂子', light: '#cc7d1b', dark: '#db9751' },
    { name: '秋香', light: '#848538', dark: '#989a5b' },
    { name: '霜紫', light: '#9a67a6', dark: '#ac7fb6' },
    { name: '远山', light: '#6084a9', dark: '#7a99b9' },
  ] },
  { name: '冬', colors: [
    { name: '松青', light: '#317f61', dark: '#549278' },
    { name: '雪青', light: '#8e84c8', dark: '#a39cd7' },
    { name: '冰蓝', light: '#529cbf', dark: '#74b1cf' },
    { name: '黛蓝', light: '#4b6fa9', dark: '#6584b6' },
    { name: '腊梅', light: '#b88a06', dark: '#caa146' },
    { name: '冬青', light: '#547e4b', dark: '#6e9266' },
    { name: '寒烟', light: '#7a909b', dark: '#92a5af' },
    { name: '炭灰', light: '#5e646c', dark: '#73787f' },
  ] },
  { name: '节日', colors: [
    { name: '春节红', light: '#db3834', dark: '#e86156' },
    { name: '元宵金', light: '#c38406', dark: '#d69b3f' },
    { name: '清明青', light: '#3a927d', dark: '#5fa592' },
    { name: '端午艾', light: '#668644', dark: '#7e9a62' },
    { name: '七夕紫', light: '#926bcf', dark: '#a585db' },
    { name: '中秋月', light: '#b7933f', dark: '#c9aa66' },
    { name: '重阳菊', light: '#d07506', dark: '#e28e42' },
    { name: '腊八褐', light: '#976346', dark: '#a87a61' },
  ] },
  { name: '矿石', colors: [
    { name: '朱砂', light: '#de482f', dark: '#eb6c55' },
    { name: '赭石', light: '#ac603d', dark: '#bc795c' },
    { name: '石青', light: '#297ab6', dark: '#508fc3' },
    { name: '石绿', light: '#2d9570', dark: '#58a887' },
    { name: '孔雀蓝', light: '#0a8393', dark: '#3398a8' },
    { name: '胭脂', light: '#be425f', dark: '#cd6276' },
    { name: '藤黄', light: '#bd9600', dark: '#d0ad45' },
    { name: '琉璃', light: '#5d76d0', dark: '#768edb' },
  ] },
  { name: '器物', colors: [
    { name: '青瓷', light: '#619587', dark: '#7da99d' },
    { name: '天青', light: '#5a9aaa', dark: '#79afbc' },
    { name: '霁蓝', light: '#3b6ac5', dark: '#5881cf' },
    { name: '祭红', light: '#bd373f', dark: '#cb5a5b' },
    { name: '钧紫', light: '#a55d96', dark: '#b677a8' },
    { name: '茶褐', light: '#a16d40', dark: '#b2845f' },
    { name: '檀色', light: '#b66d54', dark: '#c68670' },
    { name: '古铜', light: '#966b34', dark: '#a78155' },
  ] },
  { name: '中性', colors: [
    { name: '墨', light: '#55585e', dark: '#696c71' },
    { name: '玄青', light: '#5b6375', dark: '#707787' },
    { name: '烟灰', light: '#747b83', dark: '#899097' },
    { name: '苍灰', light: '#738485', dark: '#8a9999' },
    { name: '银鼠', light: '#8f9298', dark: '#a5a8ad' },
    { name: '驼色', light: '#9c8067', dark: '#ae9680' },
    { name: '岩灰', light: '#76756b', dark: '#8b8981' },
    { name: '暖灰', light: '#8d847d', dark: '#a29a94' },
  ] },
];

export const PRESET_COLORS: PresetColor[] = COLOR_GROUPS.flatMap((g) => g.colors);
const BY_LIGHT = new Map(PRESET_COLORS.map((c) => [c.light.toLowerCase(), c]));

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
