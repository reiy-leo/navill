import { describe, expect, it } from 'vitest';
import { bingMarket, parseBing } from './bing';

describe('bing', () => {
  it('parses UHD url', () => {
    const img = parseBing({ images: [{ urlbase: '/th?id=OHR.X_ZH-CN1', url: '/th?id=OHR.X_ZH-CN1_1920x1080.jpg', title: 'T', copyright: 'C' }] }, '2026-10-17');
    expect(img).toEqual({ day: '2026-10-17', url: 'https://www.bing.com/th?id=OHR.X_ZH-CN1_UHD.jpg', title: 'T', copyright: 'C', link: undefined });
  });
  it('rejects empty', () => expect(parseBing({}, 'd')).toBeNull());
  it('market', () => { expect(bingMarket('zh-TW')).toBe('zh-CN'); expect(bingMarket('en-GB')).toBe('en-US'); });
});
