import { describe, expect, it } from 'vitest';
import { clipWidth, textWidth } from './textWidth';

describe('textWidth', () => {
  it('中文计 2、英文计 1', () => {
    expect(textWidth('工作abc')).toBe(7);
    expect(textWidth('，Ａ')).toBe(4);
  });
  it('按宽度截断', () => {
    expect(clipWidth('一二三四五六七八九十十一十二十三', 24)).toBe('一二三四五六七八九十十一');
    expect(clipWidth('a'.repeat(30), 24)).toHaveLength(24);
    expect(clipWidth('ab中文', 3)).toBe('ab');
  });
});
