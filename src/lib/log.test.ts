import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDB, type LogEntry, type NavillDB } from '@/src/db';
import { browserName, groupByMonth, logInstallOnce, mergeLogs, onLogged, osName } from './log';
import { createBookmark, createDrawer, createWorkspace, deleteWorkspace, ensureSeed, movePlacement, removePlacement } from './store';
import { shortcutSyncDecision } from './sync/shortcut';

const L = (id: string, at: number, deviceId = 'd1'): LogEntry => ({ id, at, deviceId, kind: 'create', targetType: 'bookmark', summary: id });

describe('⌘S 同步跳过规则', () => {
  const now = 1_000_000_000;
  const base = { signedIn: true, enabled: true, pending: 3, now };
  it('未登录 / 未开启优先提醒', () => {
    expect(shortcutSyncDecision({ ...base, signedIn: false })).toBe('signed-out');
    expect(shortcutSyncDecision({ ...base, enabled: false })).toBe('off');
  });
  it('3 分钟内跳过', () => {
    expect(shortcutSyncDecision({ ...base, lastSyncAt: now - 2 * 60_000 })).toBe('recent');
    expect(shortcutSyncDecision({ ...base, lastSyncAt: now - 3 * 60_000 })).toBe('run');
  });
  it('没有改动时跳过', () => {
    expect(shortcutSyncDecision({ ...base, pending: 0 })).toBe('empty');
    expect(shortcutSyncDecision({ ...base })).toBe('run');
  });
});

describe('日志合并与分组', () => {
  it('按 id 去重，新的在前', () => {
    const r = mergeLogs([L('a', 1), L('b', 3)], [L('b', 3), L('c', 2, 'd2')]);
    expect(r.map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });
  it('按 UTC 月份分组', () => {
    const g = groupByMonth([L('x', Date.UTC(2026, 9, 31, 23)), L('y', Date.UTC(2026, 10, 1)), L('z', Date.UTC(2026, 9, 1))]);
    expect([...g.keys()]).toEqual(['2026-10', '2026-11']);
    expect(g.get('2026-10')!.map((x) => x.id)).toEqual(['z', 'x']);
  });
  it('从 UA 识别浏览器与系统', () => {
    const edge = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0';
    const chrome = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
    expect(browserName(edge)).toBe('Edge');
    expect(osName(edge)).toBe('Windows');
    expect(browserName(chrome)).toBe('Chrome');
    expect(osName(chrome)).toBe('macOS');
  });
});

describe('store 层记录日志', () => {
  let db: NavillDB;
  let n = 0;
  beforeEach(async () => {
    db = createDB(`log-${n++}`);
    await ensureSeed(db);
  });

  it('嵌套操作只记最外层一条', async () => {
    const ws = await createWorkspace(db, { name: '工作' });
    const d = await createDrawer(db, ws.id, '前端');
    await createBookmark(db, { url: 'https://a.com', title: 'A' }, ws.id, d.id);
    await db.logs.clear();
    await deleteWorkspace(db, ws.id);
    const logs = await db.logs.toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ kind: 'delete', targetType: 'workspace', summary: '删除工作区「工作」' });
  });

  it('同一位置内重排不算移动；跨抽屉移动记一条并通知', async () => {
    const ws = await createWorkspace(db, { name: '工作' });
    const d1 = await createDrawer(db, ws.id, '甲');
    const d2 = await createDrawer(db, ws.id, '乙');
    const { placement } = await createBookmark(db, { url: 'https://a.com', title: 'A' }, ws.id, d1.id);
    await createBookmark(db, { url: 'https://b.com', title: 'B' }, ws.id, d1.id);
    await db.logs.clear();
    const seen: LogEntry[] = [];
    const off = onLogged((e) => seen.push(e));
    await movePlacement(db, placement.id, ws.id, d1.id, 1);
    expect(await db.logs.count()).toBe(0);
    await movePlacement(db, placement.id, ws.id, d2.id);
    off();
    expect(seen.map((e) => e.summary)).toEqual(['书签「A」移动到「工作 / 乙」']);
    await removePlacement(db, placement.id);
    expect((await db.logs.orderBy('at').last())?.kind).toBe('delete');
  });

  it('新设备只记一次', async () => {
    await logInstallOnce(db);
    await logInstallOnce(db);
    expect((await db.logs.filter((l) => l.kind === 'install').toArray()).length).toBe(1);
  });
});
