import type { NavillDB, SyncEntity } from '@/src/db';

export const uid = () => crypto.randomUUID();

/** 所有写操作走同一个读写事务 */
export function tx<T>(db: NavillDB, fn: () => Promise<T>): Promise<T> {
  return db.transaction('rw', db.tables, fn);
}

/** 记一条待同步变更（同一实体合并为一条） */
export async function dirty(db: NavillDB, entity: SyncEntity, entityId: string, op: 'put' | 'delete' = 'put') {
  const now = Date.now();
  await db.outbox.put({ id: `${entity}:${entityId}`, entity, entityId, op, updatedAt: now });
  if (op === 'delete') await db.tombstones.put({ id: `${entity}:${entityId}`, entity, entityId, deletedAt: now });
}

type Row = { id: string; updatedAt: number };

export async function put<T extends Row>(db: NavillDB, entity: SyncEntity, row: T): Promise<T> {
  row.updatedAt = Date.now();
  await (db[entity] as unknown as { put(r: T): Promise<unknown> }).put(row);
  await dirty(db, entity, row.id);
  return row;
}

export async function patch<T extends Row>(db: NavillDB, entity: SyncEntity, id: string, changes: Partial<T>) {
  await (db[entity] as unknown as { update(id: string, c: object): Promise<number> }).update(id, {
    ...changes,
    updatedAt: Date.now(),
  });
  await dirty(db, entity, id);
}

export async function del(db: NavillDB, entity: SyncEntity, id: string) {
  await (db[entity] as unknown as { delete(id: string): Promise<void> }).delete(id);
  await dirty(db, entity, id, 'delete');
}

export async function deviceId(db: NavillDB): Promise<string> {
  const m = await db.meta.get('deviceId');
  if (m) return m.value as string;
  const id = uid();
  await db.meta.put({ key: 'deviceId', value: id });
  return id;
}
