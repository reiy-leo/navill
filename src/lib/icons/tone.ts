/**
 * 判断图标是否「几乎全白」或「几乎全黑」的单色透明图标（如 GitHub、Vercel 的黑色 logo）。
 * 这类图标在同色背景上几乎看不见，界面会用 CSS invert 反转颜色。
 * 有底色（不透明像素多）或有颜色的图标不处理。跨域图片读不到像素时返回 null。
 */
export type IconTone = 'light' | 'dark' | null;

const cache = new Map<string, IconTone>();

export function iconToneOf(src: string): IconTone | undefined {
  return cache.get(src);
}

export function measureIconTone(img: HTMLImageElement): IconTone {
  const src = img.currentSrc || img.src;
  if (cache.has(src)) return cache.get(src)!;
  let tone: IconTone = null;
  try {
    const n = 32;
    const c = document.createElement('canvas');
    c.width = n; c.height = n;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, n, n);
    tone = classifyTone(ctx.getImageData(0, 0, n, n).data);
  } catch { tone = null; /* 跨域图片：画布被污染，无法读取 */ }
  cache.set(src, tone);
  return tone;
}

/** RGBA 像素 → 色调。导出供测试 */
export function classifyTone(d: Uint8ClampedArray | number[]): IconTone {
  let opaque = 0, transparent = 0, lum = 0, sat = 0;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]!;
    if (a < 40) { transparent++; continue; }
    const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    lum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    sat += (max - min) / 255;
    opaque++;
  }
  const total = opaque + transparent;
  if (!opaque || transparent / total < 0.2) return null; // 有底色的图标自带对比
  lum /= opaque; sat /= opaque;
  if (sat > 0.15) return null; // 有颜色
  if (lum > 0.88) return 'light';
  if (lum < 0.15) return 'dark';
  return null;
}
