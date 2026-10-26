import { describe, expect, it } from 'vitest';
import { cleanUser, normUrl } from './github';

describe('github', () => {
  it('cleanUser 接受用户名、@name 和主页链接', () => {
    expect(cleanUser('reiy-leo')).toBe('reiy-leo');
    expect(cleanUser(' @reiy-leo ')).toBe('reiy-leo');
    expect(cleanUser('https://github.com/reiy-leo?tab=stars')).toBe('reiy-leo');
    expect(cleanUser('not a name')).toBe('');
    expect(cleanUser('')).toBe('');
  });
  it('normUrl 忽略大小写和末尾斜杠', () => {
    expect(normUrl('https://GitHub.com/a/b/')).toBe(normUrl('https://github.com/a/b'));
  });
});
