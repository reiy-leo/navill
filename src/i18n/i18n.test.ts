import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from './en.json';

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
});
