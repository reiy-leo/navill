import { useEffect, useState } from 'react';
import { bingUrl, cachedImageUrl, getBingImage, type BingImage } from '@/src/lib/bing';
import type { Settings } from '@/src/lib/settings';
import { WorkspaceBackdrop } from './WorkspaceBackdrop';

/**
 * 页面背景（设置 → 外观 → 背景）：纯色（浅色纯白、深色纯黑）/ 工作区颜色渐变 / Bing 每日图片。
 * 图片可加磨砂模糊，并按明暗模式盖一层薄遮罩保证文字可读；图片取不到时退回渐变。
 */
export function PageBackground({ settings, color }: { settings: Settings; color?: string }) {
  const kind = settings.background;
  const [img, setImg] = useState<BingImage | null>(null);
  const [src, setSrc] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (kind !== 'bing') return;
    let live = true;
    void getBingImage().then(async (i) => {
      if (!live || !i) return;
      setImg(i);
      const u = await cachedImageUrl(bingUrl(i));
      if (live) setSrc(u);
    });
    return () => { live = false; };
  }, [kind]);
  useEffect(() => () => { if (src?.startsWith('blob:')) URL.revokeObjectURL(src); }, [src]);

  if (kind === 'plain') return <div aria-hidden className="nv-plain pointer-events-none fixed inset-0 -z-10" />;
  if (kind === 'bing' && img && src) {
    const blur = settings.backgroundBlur;
    return (
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" title={img.copyright}>
        <img
          src={src}
          alt=""
          onLoad={() => setLoaded(true)}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
          style={{ opacity: loaded ? 1 : 0, filter: blur ? `blur(${blur}px)` : undefined, transform: blur ? 'scale(1.15)' : undefined }}
        />
        <div className="nv-bg-veil absolute inset-0" />
      </div>
    );
  }
  // 主页和工作区用同一个渐变（主页由调用方传入固定中性色）
  return <WorkspaceBackdrop color={color} />;
}
