import { SYNC_ENTITIES, type NavillDB, type OpenEvent, type SyncEntity } from '@/src/db';
import { ensureSeed } from '../store/seed';

import { tr } from '@/src/i18n';
export const BACKUP_FORMAT = 'navill-backup';
export const BACKUP_VERSION = 2;

export type Snapshot = Record<SyncEntity, Array<{ id: string; updatedAt: number }>>;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  data: Snapshot;
  openEvents: OpenEvent[];
}

export async function snapshot(db: NavillDB): Promise<Snapshot> {
  const out = {} as Snapshot;
  for (const e of SYNC_ENTITIES) out[e] = (await db[e].toArray()) as Array<{ id: string; updatedAt: number }>;
  return out;
}

export async function exportBackup(db: NavillDB): Promise<Backup> {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    data: await snapshot(db),
    openEvents: await db.openEvents.toArray(),
  };
}

export function parseBackup(text: string): Backup {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error(tr('不是有效的 JSON 文件'));
  }
  const b = obj as Partial<Backup>;
  if (b.format !== BACKUP_FORMAT || typeof b.data !== 'object' || !b.data) throw new Error(tr('不是 Navill 备份文件'));
  if ((b.version ?? 0) > BACKUP_VERSION) throw new Error(tr('备份来自更新版本的 Navill，请先升级扩展'));
  return b as Backup;
}

/**
 * 恢复备份。
 * - replace：清空本地后写入备份
 * - merge：按条目合并，updatedAt 新者胜
 */
export async function restoreBackup(db: NavillDB, backup: Backup, mode: 'replace' | 'merge') {
  await db.transaction('rw', db.tables, async () => {
    if (mode === 'replace') {
      for (const e of SYNC_ENTITIES) await db[e].clear();
      await db.openEvents.clear();
      await db.tombstones.clear();
    }
    for (const e of SYNC_ENTITIES) {
      const rows = backup.data[e] ?? [];
      const table = db[e] as unknown as { bulkGet(ids: string[]): Promise<Array<{ updatedAt: number } | undefined>>; bulkPut(r: unknown[]): Promise<unknown> };
      if (mode === 'merge') {
        const existing = await table.bulkGet(rows.map((r) => r.id));
        await table.bulkPut(rows.filter((r, i) => !existing[i] || existing[i]!.updatedAt <= r.updatedAt));
      } else {
        await table.bulkPut(rows);
      }
      await db.outbox.bulkPut(rows.map((r) => ({ id: `${e}:${r.id}`, entity: e, entityId: r.id, op: 'put' as const, updatedAt: Date.now() })));
    }
    if (backup.openEvents?.length) await db.openEvents.bulkPut(backup.openEvents);
    await db.meta.put({ key: 'importedAt', value: Date.now() });
  });
  await ensureSeed(db);
}
