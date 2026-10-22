import Dexie, { type Transaction } from 'dexie';
import type { LogEntry, LogKind, LogTarget, NavillDB } from '@/src/db';
import { deviceId, tx, uid } from './store/core';
import { monthKey } from './sync/merge';

import { tr } from '@/src/i18n';
/**
 * 日志：记录用户的写操作（工作区 / 抽屉 / 书签的新建、改名、编辑、删除、移动、归档、恢复、分身），
 * 以及新设备首次运行、登录同步。在 store 层记录，所有入口都覆盖；
 * 嵌套操作（删除工作区时连带删除抽屉）只记最外层一条。
 */
export interface LogInput { kind: LogKind; targetType: LogTarget; targetId?: string; summary: string }

const listeners = new Set<(e: LogEntry) => void>();
/** 订阅本页面写入的日志（事务提交后触发），用于弹出提醒 */
export function onLogged(fn: (e: LogEntry) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

type Tx = Transaction & { __navillLog?: boolean };

/** 当前事务链上还没有外层操作在记日志，则由本次操作负责记录 */
function claim(): boolean {
  const t = Dexie.currentTransaction as Tx | null;
  for (let x: Tx | undefined | null = t; x; x = x.parent as Tx | undefined) if (x.__navillLog) return false;
  if (t) t.__navillLog = true;
  return true;
}

export function browserName(ua: string): string {
  if (/Edg(e|A|iOS)?\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return tr('浏览器');
}

export function osName(ua: string): string {
  if (/Windows/.test(ua)) return 'Windows';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad/.test(ua)) return 'iOS';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua)) return 'Linux';
  return '';
}

export function deviceLabel(ua = globalThis.navigator?.userAgent ?? ''): string {
  return [browserName(ua), osName(ua)].filter(Boolean).join(' · ');
}

async function write(db: NavillDB, input: LogInput): Promise<LogEntry> {
  const entry: LogEntry = { id: uid(), at: Date.now(), deviceId: await deviceId(db), device: deviceLabel(), ...input };
  await db.logs.add(entry);
  return entry;
}

function emit(entries: LogEntry[]) {
  for (const e of entries) for (const fn of listeners) fn(e);
}

/**
 * 包一层写操作：fn 里调用 log() 记日志；被别的已记日志的操作嵌套调用时，log() 什么也不做。
 */
export async function logged<T>(db: NavillDB, fn: (log: (i: LogInput) => void) => Promise<T>): Promise<T> {
  const pending: LogInput[] = [];
  const written: LogEntry[] = [];
  const res = await tx(db, async () => {
    const own = claim();
    const r = await fn((i) => { if (own) pending.push(i); });
    for (const i of pending) written.push(await write(db, i));
    return r;
  });
  emit(written);
  return res;
}

/** 直接记一条（不在嵌套操作里），如登录同步 */
export function addLog(db: NavillDB, input: LogInput): Promise<void> {
  return logged(db, async (log) => log(input));
}

/** 本设备第一次运行时记一条「新设备 / 新浏览器」，只记一次 */
export async function logInstallOnce(db: NavillDB): Promise<void> {
  await tx(db, async () => {
    if (await db.meta.get('installLogged')) return;
    await db.meta.put({ key: 'installLogged', value: Date.now() });
    await write(db, { kind: 'install', targetType: 'device', summary: tr('新设备：{0}', deviceLabel()) });
  });
}

/** 合并日志：按 id 去重，新的在前。纯函数 */
export function mergeLogs(...lists: LogEntry[][]): LogEntry[] {
  const m = new Map<string, LogEntry>();
  for (const l of lists) for (const e of l) if (!m.has(e.id)) m.set(e.id, e);
  return [...m.values()].sort((a, b) => b.at - a.at);
}

/** 截断显示用的名称 */
export const q = (s: string | undefined) => `「${(s ?? '').length > 40 ? `${s!.slice(0, 40)}…` : s ?? ''}」`;

/** 按 UTC 月份分组（时间正序），用于按月上传 */
export function groupByMonth<T extends { at: number }>(rows: T[]): Map<string, T[]>;
export function groupByMonth<T>(rows: T[], at: (r: T) => number): Map<string, T[]>;
export function groupByMonth<T>(rows: T[], at: (r: T) => number = (r) => (r as { at: number }).at): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const e of [...rows].sort((a, b) => at(a) - at(b))) {
    const k = monthKey(at(e));
    const list = m.get(k);
    if (list) list.push(e); else m.set(k, [e]);
  }
  return m;
}
