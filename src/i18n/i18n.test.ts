import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from './en.json';
import { LANGS, langFromLocale } from './index';

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
});

describe('i18n', () => {
  it('每个 tr() 文案都有英文翻译', () => {
    const dict = en as Record<string, string>;
    const missing: string[] = [];
    for (const f of [...walk('src'), ...walk('entrypoints')]) {
      for (const m of readFileSync(f, 'utf8').matchAll(/\btr\('((?:[^'\\]|\\.)*)'/g)) {
        const key = m[1]!.replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
        if (!(key in dict)) missing.push(`${f}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  const holes = (s: string) => (s.match(/\{\d+\}/g) ?? []).sort().join(',');
  for (const code of Object.keys(LANGS).filter((c) => c !== 'zh' && c !== 'en')) {
    it(`${code}.json 与 en.json 键一致、占位符一致`, () => {
      const dict = JSON.parse(readFileSync(join('src/i18n', `${code}.json`), 'utf8')) as Record<string, string>;
      expect(Object.keys(dict)).toEqual(Object.keys(en));
      const bad = Object.entries(dict).filter(([k, v]) => !v.trim() || holes(v) !== holes(k)).map(([k]) => k);
      expect(bad).toEqual([]);
    });
  }

  it('浏览器语言映射', () => {
    expect(langFromLocale('zh-TW')).toBe('zh');
    expect(langFromLocale('pt-BR')).toBe('pt');
    expect(langFromLocale('pt-PT')).toBe('pt');
    expect(langFromLocale('in')).toBe('id');
    expect(langFromLocale('ko')).toBe('en');
  });
});
