import { useSyncExternalStore } from 'react';

import { tr } from '@/src/i18n';
/**
 * 预置颜色：8 类 × 8 种 = 64 色，按节气四季、节日、矿石、器物、中性分类，名字取自中国传统色。
 * 每种是一对：light 用于浅色主题，dark 用于深色主题（略提亮、降饱和），两者都能承载白色文字。
 * 数据里只存 light 值（兼容旧数据与同步），显示时用 tone() 换成当前主题对应的颜色。
 */
export interface PresetColor { name: string; light: string; dark: string }
export interface ColorGroup { name: string; colors: PresetColor[] }

export const COLOR_GROUPS: ColorGroup[] = [
  { name: tr('春'), colors: [
    { name: tr('迎春'), light: '#b39609', dark: '#c7ad42' },
    { name: tr('嫩芽'), light: '#779b1e', dark: '#8faf51' },
    { name: tr('柳色'), light: '#58994a', dark: '#76ac6a' },
    { name: tr('青团'), light: '#438c60', dark: '#639f78' },
    { name: tr('春水'), light: '#1d9999', dark: '#53acac' },
    { name: tr('桃夭'), light: '#d2678c', dark: '#e184a1' },
    { name: tr('杏红'), light: '#d3694f', dark: '#e1856e' },
    { name: tr('樱草'), light: '#c38824', dark: '#d4a056' },
  ] },
  { name: tr('夏'), colors: [
    { name: tr('荷叶'), light: '#409156', dark: '#62a471' },
    { name: tr('荷花'), light: '#ca5e96', dark: '#d97caa' },
    { name: tr('榴火'), light: '#da4339', dark: '#e7685b' },
    { name: tr('碧空'), light: '#248fcc', dark: '#54a4d9' },
    { name: tr('湖蓝'), light: '#0e8ba8', dark: '#38a0bd' },
    { name: tr('薄荷'), light: '#33a182', dark: '#5fb599' },
    { name: tr('葡萄'), light: '#8b5fb9', dark: '#9d78c6' },
    { name: tr('芒种'), light: '#bb8d0c', dark: '#d0a43e' },
  ] },
  { name: tr('秋'), colors: [
    { name: tr('枫红'), light: '#cf4040', dark: '#dd645e' },
    { name: tr('丹柿'), light: '#dc631e', dark: '#ea814f' },
    { name: tr('银杏'), light: '#b28d0e', dark: '#c7a33a' },
    { name: tr('稻黄'), light: '#b5820c', dark: '#c6994a' },
    { name: tr('桂子'), light: '#cc7d1b', dark: '#db9751' },
    { name: tr('秋香'), light: '#848538', dark: '#989a5b' },
    { name: tr('霜紫'), light: '#9a67a6', dark: '#ac7fb6' },
    { name: tr('远山'), light: '#6084a9', dark: '#7a99b9' },
  ] },
  { name: tr('冬'), colors: [
    { name: tr('松青'), light: '#317f61', dark: '#549278' },
    { name: tr('雪青'), light: '#8e84c8', dark: '#a39cd7' },
    { name: tr('冰蓝'), light: '#529cbf', dark: '#74b1cf' },
    { name: tr('黛蓝'), light: '#4b6fa9', dark: '#6584b6' },
    { name: tr('腊梅'), light: '#b88a06', dark: '#caa146' },
    { name: tr('冬青'), light: '#547e4b', dark: '#6e9266' },
    { name: tr('寒烟'), light: '#7a909b', dark: '#92a5af' },
    { name: tr('炭灰'), light: '#5e646c', dark: '#73787f' },
  ] },
  { name: tr('节日'), colors: [
    { name: tr('春节红'), light: '#db3834', dark: '#e86156' },
    { name: tr('元宵金'), light: '#c38406', dark: '#d69b3f' },
    { name: tr('清明青'), light: '#3a927d', dark: '#5fa592' },
    { name: tr('端午艾'), light: '#668644', dark: '#7e9a62' },
    { name: tr('七夕紫'), light: '#926bcf', dark: '#a585db' },
    { name: tr('中秋月'), light: '#b7933f', dark: '#c9aa66' },
    { name: tr('重阳菊'), light: '#d07506', dark: '#e28e42' },
    { name: tr('腊八褐'), light: '#976346', dark: '#a87a61' },
  ] },
  { name: tr('矿石'), colors: [
    { name: tr('朱砂'), light: '#de482f', dark: '#eb6c55' },
    { name: tr('赭石'), light: '#ac603d', dark: '#bc795c' },
    { name: tr('石青'), light: '#297ab6', dark: '#508fc3' },
    { name: tr('石绿'), light: '#2d9570', dark: '#58a887' },
    { name: tr('孔雀蓝'), light: '#0a8393', dark: '#3398a8' },
    { name: tr('胭脂'), light: '#be425f', dark: '#cd6276' },
    { name: tr('藤黄'), light: '#bd9600', dark: '#d0ad45' },
    { name: tr('琉璃'), light: '#5d76d0', dark: '#768edb' },
  ] },
  { name: tr('器物'), colors: [
    { name: tr('青瓷'), light: '#619587', dark: '#7da99d' },
    { name: tr('天青'), light: '#5a9aaa', dark: '#79afbc' },
    { name: tr('霁蓝'), light: '#3b6ac5', dark: '#5881cf' },
    { name: tr('祭红'), light: '#bd373f', dark: '#cb5a5b' },
    { name: tr('钧紫'), light: '#a55d96', dark: '#b677a8' },
    { name: tr('茶褐'), light: '#a16d40', dark: '#b2845f' },
    { name: tr('檀色'), light: '#b66d54', dark: '#c68670' },
    { name: tr('古铜'), light: '#966b34', dark: '#a78155' },
  ] },
  { name: tr('中性'), colors: [
    { name: tr('墨'), light: '#55585e', dark: '#696c71' },
    { name: tr('玄青'), light: '#5b6375', dark: '#707787' },
    { name: tr('烟灰'), light: '#747b83', dark: '#899097' },
    { name: tr('苍灰'), light: '#738485', dark: '#8a9999' },
    { name: tr('银鼠'), light: '#8f9298', dark: '#a5a8ad' },
    { name: tr('驼色'), light: '#9c8067', dark: '#ae9680' },
    { name: tr('岩灰'), light: '#76756b', dark: '#8b8981' },
    { name: tr('暖灰'), light: '#8d847d', dark: '#a29a94' },
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
