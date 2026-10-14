/** 从网页 HTML 里挑出最清晰的图标候选（纯函数，便于测试） */
export interface IconCandidate { url: string; size: number; kind: 'icon' | 'apple' | 'manifest' | 'svg' }

const sizeOf = (sizes: string | null | undefined): number => {
  if (!sizes) return 0;
  if (/any/i.test(sizes)) return 512;
  return Math.max(0, ...sizes.split(/\s+/).map((s) => Number(s.toLowerCase().split('x')[0]) || 0));
};

export function iconCandidatesFromHtml(html: string, baseUrl: string): { candidates: IconCandidate[]; manifest?: string } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const base = doc.querySelector('base[href]')?.getAttribute('href');
  const abs = (href: string) => { try { return new URL(href, base ? new URL(base, baseUrl) : baseUrl).href; } catch { return ''; } };
  const out: IconCandidate[] = [];
  for (const link of doc.querySelectorAll<HTMLLinkElement>('link[rel][href]')) {
    const rel = link.getAttribute('rel')!.toLowerCase();
    const href = abs(link.getAttribute('href')!);
    if (!href) continue;
    if (rel.includes('apple-touch-icon')) out.push({ url: href, size: sizeOf(link.getAttribute('sizes')) || 180, kind: 'apple' });
    else if (/(^|\s)icon(\s|$)/.test(rel) || rel.includes('shortcut')) {
      const svg = /\.svg(\?|$)/i.test(href) || link.getAttribute('type') === 'image/svg+xml';
      out.push({ url: href, size: svg ? 512 : sizeOf(link.getAttribute('sizes')) || 16, kind: svg ? 'svg' : 'icon' });
    }
  }
  const m = doc.querySelector('link[rel="manifest"][href]')?.getAttribute('href');
  return { candidates: out, manifest: m ? abs(m) || undefined : undefined };
}

export function iconCandidatesFromManifest(json: unknown, manifestUrl: string): IconCandidate[] {
  const icons = (json as { icons?: { src?: string; sizes?: string; purpose?: string }[] })?.icons;
  if (!Array.isArray(icons)) return [];
  return icons
    .filter((i) => i.src && !/monochrome/.test(i.purpose ?? ''))
    .flatMap((i): IconCandidate[] => { try { return [{ url: new URL(i.src!, manifestUrl).href, size: sizeOf(i.sizes), kind: 'manifest' }]; } catch { return []; } });
}

/** 按清晰度排序：≥64 的越接近 128 越好；再往下按尺寸从大到小 */
export function rankCandidates(list: IconCandidate[]): IconCandidate[] {
  const score = (c: IconCandidate) => (c.size >= 64 ? 10000 - Math.abs(c.size - 128) : c.size);
  const seen = new Set<string>();
  return [...list].sort((a, b) => score(b) - score(a)).filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));
}
