import { describe, expect, it } from 'vitest';
import { replaceEqualDeep } from './equal';

describe('replaceEqualDeep', () => {
  it('keeps unchanged branches by reference', () => {
    const prev = { a: { x: 1 }, b: [{ id: 1 }, { id: 2 }] };
    const next = { a: { x: 1 }, b: [{ id: 1 }, { id: 3 }] };
    const r = replaceEqualDeep(prev, next);
    expect(r).not.toBe(prev);
    expect(r.a).toBe(prev.a);
    expect(r.b[0]).toBe(prev.b[0]);
    expect(r.b[1]).toEqual(next.b[1]);
    expect(r).toEqual(next);
  });
  it('returns prev when deeply equal', () => {
    const prev = { a: [1, 2], b: { c: 'x' } };
    expect(replaceEqualDeep(prev, { a: [1, 2], b: { c: 'x' } })).toBe(prev);
  });
  it('treats added keys and length changes as changes', () => {
    const prev = { a: 1 } as Record<string, unknown>;
    const next = { a: 1, b: undefined };
    expect(replaceEqualDeep(prev, next)).not.toBe(prev);
    expect(replaceEqualDeep([1], [1, 2])).toEqual([1, 2]);
  });
  it('compares non-plain objects by identity', () => {
    const s = new Set([1]);
    expect(replaceEqualDeep({ s }, { s: new Set([1]) }).s).not.toBe(s);
  });
});
