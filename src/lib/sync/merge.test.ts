import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../io/backup';
import { countsFromEvents, mergeStates, monthKey } from './merge';

const snap = (bookmarks: Array<{ id: string; updatedAt: number; title?: string }>): Snapshot =>
  ({ workspaces: [], drawers: [], bookmarks, placements: [], aliasGroups: [], modes: [], tags: [] }) as unknown as Snapshot;

describe('同步合并', () => {
  it('updatedAt 新者胜，双方独有的都保留', () => {
    const now = Date.now();
    const r = mergeStates(
      snap([{ id: 'a', updatedAt: now, title: 'L' }, { id: 'b', updatedAt: now }]),
      [],
      snap([{ id: 'a', updatedAt: now + 1, title: 'R' }, { id: 'c', updatedAt: now }]),
    );
    expect(r.merged.bookmarks.map((x) => x.id).sort()).toEqual(['a', 'b', 'c']);
    expect(r.puts.bookmarks!.map((x) => x.id).sort()).toEqual(['a', 'c']);
  });

  it('远端墓碑比本地条目新时删除本地', () => {
    const now = Date.now();
    const r = mergeStates(snap([{ id: 'a', updatedAt: now }]), [], snap([]), [
      { id: 'bookmarks:a', entity: 'bookmarks', entityId: 'a', deletedAt: now + 5 },
    ]);
    expect(r.deletes.bookmarks).toEqual(['a']);
    expect(r.merged.bookmarks).toEqual([]);
  });

  it('本地在删除之后又改过，则保留', () => {
    const now = Date.now();
    const r = mergeStates(snap([{ id: 'a', updatedAt: now + 10 }]), [], snap([]), [
      { id: 'bookmarks:a', entity: 'bookmarks', entityId: 'a', deletedAt: now },
    ]);
    expect(r.merged.bookmarks).toHaveLength(1);
  });

  it('由事件重算计数；月份键', () => {
    const c = countsFromEvents([
      { id: '1', bookmarkId: 'a', placementId: 'p', openedAt: 5, deviceId: 'd1' },
      { id: '2', bookmarkId: 'a', placementId: 'q', openedAt: 9, deviceId: 'd2' },
    ]);
    expect(c.get('a')).toEqual({ openCount: 2, lastOpenedAt: 9 });
    expect(monthKey(Date.UTC(2026, 9, 14))).toBe('2026-10');
  });
});
