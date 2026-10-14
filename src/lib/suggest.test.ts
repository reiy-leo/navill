import { describe, expect, it } from 'vitest';
import { rankSuggestions } from './suggest';

describe('浏览记录补全排序', () => {
  it('按访问次数排序、去重、过滤非网页', () => {
    const r = rankSuggestions([
      { url: 'https://a.com/', title: 'A', visitCount: 3 },
      { url: 'https://a.com', title: 'A2', visitCount: 1 },
      { url: 'chrome://settings', title: 'S', visitCount: 99 },
      { url: 'https://b.com', title: ' B ', visitCount: 2, typedCount: 2 },
    ]);
    expect(r).toEqual([{ url: 'https://b.com', title: 'B', visits: 6 }, { url: 'https://a.com/', title: 'A', visits: 3 }]);
  });
});
