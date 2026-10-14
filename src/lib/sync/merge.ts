import type { OpenEvent, SyncEntity, Tombstone } from '@/src/db';
import type { Snapshot } from '../io/backup';

export interface RemoteState {
  format: 'navill-state';
  version: 2;
  savedAt: number;
  deviceId: string;
  data: Snapshot;
  tombstones: Tombstone[];
}

type Row = { id: string; updatedAt: number };

export interface MergeResult {
  /** 需要写入本地的行 */
  puts: Partial<Record<SyncEntity, Row[]>>;
  /** 需要从本地删除的 id */
  deletes: Partial<Record<SyncEntity, string[]>>;
  /** 合并后的完整状态（用于上传） */
  merged: Snapshot;
  tombstones: Tombstone[];
}

/**
 * 按条目合并：updatedAt 新者胜；墓碑比条目新则删除。纯函数，便于单测。
 */
export function mergeStates(
  local: Snapshot, localTombs: Tombstone[], remote: Snapshot | undefined, remoteTombs: Tombstone[] = [],
): MergeResult {
  const tombs = new Map<string, Tombstone>();
  for (const t of [...localTombs, ...remoteTombs]) {
    const old = tombs.get(t.id);
    if (!old || old.deletedAt < t.deletedAt) tombs.set(t.id, t);
  }
  const res: MergeResult = { puts: {}, deletes: {}, merged: {} as Snapshot, tombstones: [...tombs.values()] };
  const entities = Object.keys(local) as SyncEntity[];
  for (const e of entities) {
    const L = new Map(local[e].map((r) => [r.id, r]));
    const R = new Map((remote?.[e] ?? []).map((r) => [r.id, r]));
    const out: Row[] = [];
    for (const id of new Set([...L.keys(), ...R.keys()])) {
      const l = L.get(id);
      const r = R.get(id);
      let win = !l ? r! : !r ? l : r.updatedAt > l.updatedAt ? r : l;
      const t = tombs.get(`${e}:${id}`);
      if (t && t.deletedAt >= win.updatedAt) {
        if (l) (res.deletes[e] ??= []).push(id);
        continue;
      }
      if (win !== l) (res.puts[e] ??= []).push(win);
      out.push(win);
      win = win as Row;
    }
    res.merged[e] = out;
  }
  // 墓碑只保留 90 天
  const cutoff = Date.now() - 90 * 86400_000;
  res.tombstones = res.tombstones.filter((t) => t.deletedAt > cutoff);
  return res;
}

/** 由全部打开事件重算每个书签的次数与最近打开时间 */
export function countsFromEvents(events: OpenEvent[]): Map<string, { openCount: number; lastOpenedAt: number }> {
  const m = new Map<string, { openCount: number; lastOpenedAt: number }>();
  for (const e of events) {
    const c = m.get(e.bookmarkId) ?? { openCount: 0, lastOpenedAt: 0 };
    c.openCount++;
    c.lastOpenedAt = Math.max(c.lastOpenedAt, e.openedAt);
    m.set(e.bookmarkId, c);
  }
  return m;
}

export const monthKey = (t: number) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
