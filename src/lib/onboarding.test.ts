import { describe, expect, it } from 'vitest';
import { allDone, doneCount, isTagQuery, mergeOnboarding, ONBOARDING_TASKS, sameOnboarding, showOnboarding } from './onboarding';

describe('新手任务', () => {
  it('合并：完成记录取并集并保留较早时间，关闭任一处即关闭', () => {
    const a = { done: { searchKey: 100, alias: 300 }, hidden: false };
    const b = { done: { alias: 200, omnibox: 50 }, hidden: true };
    expect(mergeOnboarding(a, b)).toEqual({ done: { searchKey: 100, alias: 200, omnibox: 50 }, hidden: true });
    expect(mergeOnboarding(undefined, a)).toEqual(a);
  });

  it('只能勾上不会取消：合并结果包含双方全部完成项', () => {
    const local = { done: { bgOpen: 1 }, hidden: false };
    const remote = { done: {}, hidden: false };
    expect(mergeOnboarding(remote, local).done).toHaveProperty('bgOpen');
    expect(sameOnboarding(mergeOnboarding(remote, local), local)).toBe(true);
    expect(sameOnboarding(mergeOnboarding(remote, local), remote)).toBe(false);
  });

  it('全部完成或关闭后不再显示', () => {
    const all = { done: Object.fromEntries(ONBOARDING_TASKS.map((t) => [t, 1])), hidden: false };
    expect(doneCount(all)).toBe(ONBOARDING_TASKS.length);
    expect(allDone(all)).toBe(true);
    expect(showOnboarding(all)).toBe(false);
    expect(showOnboarding({ done: {}, hidden: true })).toBe(false);
    expect(showOnboarding({ done: { searchKey: 1 }, hidden: false })).toBe(true);
    // 未知 id（旧版或新版任务）不影响计数
    expect(doneCount({ done: { gone: 1 }, hidden: false })).toBe(0);
  });

  it('#标签 查询识别', () => {
    expect(isTagQuery('#工作')).toBe(true);
    expect(isTagQuery('react #docs')).toBe(true);
    expect(isTagQuery('#')).toBe(false);
    expect(isTagQuery('c#')).toBe(false);
  });
});
