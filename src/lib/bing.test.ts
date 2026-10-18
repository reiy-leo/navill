import { describe, expect, it } from 'vitest';
import { bingMarket, bingUrl, parseBing } from './bing';

describe('bing', () => {
  it('parses and picks size by screen width', () => {
    const img = parseBing({ images: [{ urlbase: '/th?id=OHR.X_ZH-CN1', url: '/th?id=OHR.X_ZH-CN1_1920x1080.jpg', title: 'T', copyright: 'C' }] }, '2026-10-17')!;
    expect(img).toEqual({ day: '2026-10-17', base: 'https://www.bing.com/th?id=OHR.X_ZH-CN1', title: 'T', copyright: 'C', link: undefined });
    expect(bingUrl(img, 1440)).toBe('https://www.bing.com/th?id=OHR.X_ZH-CN1_1920x1080.jpg');
    expect(bingUrl(img, 2880)).toBe('https://www.bing.com/th?id=OHR.X_ZH-CN1_UHD.jpg');
  });
  it('rejects empty', () => expect(parseBing({}, 'd')).toBeNull());
  it('market', () => { expect(bingMarket('zh-TW')).toBe('zh-CN'); expect(bingMarket('en-GB')).toBe('en-US'); });
});
