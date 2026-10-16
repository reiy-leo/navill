import { describe, expect, it } from 'vitest';
import { normUrl } from './counts';

describe('浏览记录网址比较', () => {
  it('忽略 #片段、末尾斜杠和域名大小写', () => {
    expect(normUrl('https://GitHub.com/')).toBe(normUrl('https://github.com'));
    expect(normUrl('https://a.com/x/#top')).toBe('https://a.com/x');
    expect(normUrl('https://a.com/x?q=1')).not.toBe(normUrl('https://a.com/x'));
  });
});
