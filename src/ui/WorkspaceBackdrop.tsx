/**
 * 工作区背景：把工作区颜色映射到整个页面，做成很浅、有层次的 SVG 渐变。
 * 层次：整体斜向淡染 → 左上主色光斑 → 右侧邻近色光斑 → 底部两层柔和波浪。
 * 颜色切换时 stop-color 走 CSS 过渡。
 */
function hexToHsl(hex: string): [number, number, number] {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!m) return [210, 60, 55];
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

const hsl = (h: number, s: number, l: number) => `hsl(${((h % 360) + 360) % 360} ${Math.min(100, s)}% ${Math.min(100, l)}%)`;

export function WorkspaceBackdrop({ color }: { color?: string }) {
  if (!color) return null;
  // 沿用颜色本身的饱和度和明度：同色相的深浅档、灰色在背景上也能看出区别
  const [h, s, l] = hexToHsl(color);
  const main = hsl(h, s, l);
  const near = hsl(h + 28, s, Math.min(l + 6, 90));
  const far = hsl(h - 24, s, Math.min(l + 12, 92));
  const stop = (c: string, o: number, offset: string) => (
    <stop offset={offset} style={{ stopColor: c, stopOpacity: o, transition: 'stop-color 400ms ease' }} />
  );
  return (
    <svg aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1600 1000">
      <defs>
        <linearGradient id="nv-wash" x1="0" y1="0" x2="1" y2="1">
          {stop(main, 0.1, '0')}{stop(far, 0.05, '0.55')}{stop(near, 0.09, '1')}
        </linearGradient>
        <radialGradient id="nv-glow-a" cx="0.12" cy="0.05" r="0.55">
          {stop(main, 0.22, '0')}{stop(main, 0.08, '0.5')}{stop(main, 0, '1')}
        </radialGradient>
        <radialGradient id="nv-glow-b" cx="0.92" cy="0.35" r="0.5">
          {stop(near, 0.16, '0')}{stop(near, 0.05, '0.55')}{stop(near, 0, '1')}
        </radialGradient>
        <linearGradient id="nv-wave-a" x1="0" y1="0" x2="1" y2="0">
          {stop(far, 0.1, '0')}{stop(main, 0.12, '0.6')}{stop(near, 0.08, '1')}
        </linearGradient>
        <linearGradient id="nv-wave-b" x1="0" y1="0" x2="1" y2="0">
          {stop(main, 0.08, '0')}{stop(near, 0.1, '1')}
        </linearGradient>
      </defs>
      <rect width="1600" height="1000" fill="url(#nv-wash)" />
      <rect width="1600" height="1000" fill="url(#nv-glow-a)" />
      <rect width="1600" height="1000" fill="url(#nv-glow-b)" />
      <path d="M0 760 C 300 680 560 840 900 770 S 1400 660 1600 720 L1600 1000 L0 1000 Z" fill="url(#nv-wave-a)" />
      <path d="M0 860 C 360 800 700 930 1050 860 S 1450 800 1600 840 L1600 1000 L0 1000 Z" fill="url(#nv-wave-b)" />
    </svg>
  );
}
