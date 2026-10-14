// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { iconCandidatesFromHtml, iconCandidatesFromManifest, rankCandidates } from './pick';

describe('高清图标候选', () => {
  const html = `<html><head>
    <link rel="icon" href="/favicon.ico">
    <link rel="icon" type="image/png" sizes="32x32" href="/f32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="https://cdn.x.com/apple.png">
    <link rel="icon" href="/logo.svg" type="image/svg+xml">
    <link rel="manifest" href="/site.webmanifest">
  </head></html>`;
  it('解析 link 标签与 manifest 地址', () => {
    const { candidates, manifest } = iconCandidatesFromHtml(html, 'https://x.com/a/b');
    expect(manifest).toBe('https://x.com/site.webmanifest');
    expect(candidates.map((c) => [c.kind, c.size, c.url])).toEqual([
      ['icon', 16, 'https://x.com/favicon.ico'],
      ['icon', 32, 'https://x.com/f32.png'],
      ['apple', 180, 'https://cdn.x.com/apple.png'],
      ['svg', 512, 'https://x.com/logo.svg'],
    ]);
  });
  it('manifest 图标', () => {
    expect(iconCandidatesFromManifest({ icons: [{ src: 'i/192.png', sizes: '192x192' }, { src: 'm.png', sizes: '96x96', purpose: 'monochrome' }] }, 'https://x.com/site.webmanifest'))
      .toEqual([{ url: 'https://x.com/i/192.png', size: 192, kind: 'manifest' }]);
  });
  it('排序：接近 128 的大图优先，小图垫底', () => {
    const r = rankCandidates([
      { url: 'a', size: 16, kind: 'icon' }, { url: 'b', size: 512, kind: 'svg' }, { url: 'c', size: 180, kind: 'apple' }, { url: 'c', size: 180, kind: 'apple' },
    ]);
    expect(r.map((c) => c.url)).toEqual(['c', 'b', 'a']);
  });
});
