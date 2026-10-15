import { describe, expect, it } from 'vitest';
import type { Bookmark, Placement } from '@/src/db';
import { sortItems, type Item } from './view';

const DAY = 86_400_000;
const now = 1_800_000_000_000;
const item = (id: string, openCount: number, lastDays: number | undefined, order: number): Item => ({
  placement: { id, order } as Placement,
  bookmark: { id, title: id, openCount, lastOpenedAt: lastDays === undefined ? undefined : now - lastDays * DAY } as Bookmark,
});

describe('智能排序', () => {
  it('点击多的在前，未点击的按手动顺序', () => {
    const r = sortItems([item('a', 0, undefined, 0), item('b', 5, 1, 1), item('c', 2, 1, 2), item('d', 0, undefined, 3)], 'smart', now);
    expect(r.map((x) => x.placement.id)).toEqual(['b', 'c', 'a', 'd']);
  });
  it('很久没打开的次数打折', () => {
    const r = sortItems([item('old', 10, 200, 0), item('new', 4, 2, 1)], 'smart', now);
    expect(r.map((x) => x.placement.id)).toEqual(['new', 'old']);
  });
});
