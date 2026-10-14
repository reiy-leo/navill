import { SYNC_ENTITIES, type NavillDB, type OpenEvent, type SyncEntity } from '@/src/db';
import { snapshot } from '../io/backup';
import { deviceId } from '../store/core';
import { ensureSeed } from '../store/seed';
import { syncStatusItem } from '../settings';
import { isConfigured, isSignedIn } from './auth';
import { download, gunzip, gzip, listFiles, remove, upload, type DriveFile } from './drive';
import { countsFromEvents, mergeStates, monthKey, type RemoteState } from './merge';

const STATE_FILE = 'state.json.gz';
const eventsFile = (dev: string, month: string) => `events/${dev}-${month}.jsonl.gz`;

let running: Promise<void> | null = null;

/** 立即同步（同一时刻只跑一个） */
export function syncNow(db: NavillDB): Promise<void> {
  running ??= run(db).finally(() => {
    running = null;
  });
  return running;
}

async function run(db: NavillDB) {
  if (!isConfigured() || !(await isSignedIn())) {
    await syncStatusItem.setValue({ state: 'signed-out' });
    return;
  }
  const prev = await syncStatusItem.getValue();
  await syncStatusItem.setValue({ ...prev, state: 'syncing', message: undefined });
  try {
    await ensureSeed(db);
    const dev = await deviceId(db);
    const files = await listFiles();
    const byName = new Map(files.map((f) => [f.name, f]));

    // 1. 结构：拉取远端 state，合并，写回本地，再上传合并结果
    const stateFile = byName.get(STATE_FILE);
    let remote: RemoteState | undefined;
    const lastSeen = (await db.meta.get('remoteStateModified'))?.value as string | undefined;
    const outboxCount = await db.outbox.count();
    if (stateFile && stateFile.modifiedTime !== lastSeen) {
      remote = JSON.parse(await gunzip(await download(stateFile.id))) as RemoteState;
    }
    if (remote || outboxCount > 0 || !stateFile) {
      const local = await snapshot(db);
      const tombs = await db.tombstones.toArray();
      const m = mergeStates(local, tombs, remote?.data, remote?.tombstones ?? []);
      await db.transaction('rw', db.tables, async () => {
        for (const e of SYNC_ENTITIES) {
          const table = db[e] as unknown as { bulkPut(r: unknown[]): Promise<unknown>; bulkDelete(ids: string[]): Promise<void> };
          if (m.puts[e]?.length) await table.bulkPut(m.puts[e]!);
          if (m.deletes[e]?.length) await table.bulkDelete(m.deletes[e]!);
        }
        await db.tombstones.clear();
        await db.tombstones.bulkPut(m.tombstones);
      });
      const state: RemoteState = { format: 'navill-state', version: 2, savedAt: Date.now(), deviceId: dev, data: m.merged, tombstones: m.tombstones };
      const saved = await upload(STATE_FILE, await gzip(JSON.stringify(state)), stateFile?.id);
      await db.meta.put({ key: 'remoteStateModified', value: saved.modifiedTime });
      await db.outbox.clear();
    }

    // 2. 使用统计：每台设备只写自己的月度事件文件，读取其他设备变化过的文件
    const mine = await db.openEvents.where('deviceId').equals(dev).toArray();
    const months = new Map<string, OpenEvent[]>();
    for (const e of mine) months.set(monthKey(e.openedAt), [...(months.get(monthKey(e.openedAt)) ?? []), e]);
    const uploaded = ((await db.meta.get('eventsUploaded'))?.value ?? {}) as Record<string, number>;
    for (const [month, events] of months) {
      if (uploaded[month] === events.length) continue;
      const name = eventsFile(dev, month);
      await upload(name, await gzip(events.map((e) => JSON.stringify(e)).join('\n')), byName.get(name)?.id);
      uploaded[month] = events.length;
    }
    await db.meta.put({ key: 'eventsUploaded', value: uploaded });

    const seen = ((await db.meta.get('eventsSeen'))?.value ?? {}) as Record<string, string>;
    let pulled = false;
    for (const f of files) {
      if (!f.name.startsWith('events/') || f.name.startsWith(`events/${dev}-`)) continue;
      if (seen[f.name] === f.modifiedTime) continue;
      const lines = (await gunzip(await download(f.id))).split('\n').filter(Boolean);
      await db.openEvents.bulkPut(lines.map((l) => JSON.parse(l) as OpenEvent));
      seen[f.name] = f.modifiedTime;
      pulled = true;
    }
    await db.meta.put({ key: 'eventsSeen', value: seen });
    if (pulled) await recount(db);

    await syncStatusItem.setValue({ state: 'ok', lastSyncAt: Date.now() });
    await db.meta.put({ key: 'syncFailures', value: 0 });
  } catch (e) {
    const failures = Number((await db.meta.get('syncFailures'))?.value ?? 0) + 1;
    await db.meta.put({ key: 'syncFailures', value: failures });
    await syncStatusItem.setValue({ ...prev, state: 'error', message: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

/** 失败退避：1 → 5 → 15 分钟 */
export async function backoffMinutes(db: NavillDB): Promise<number> {
  const f = Number((await db.meta.get('syncFailures'))?.value ?? 0);
  return f <= 0 ? 0 : f === 1 ? 1 : f === 2 ? 5 : 15;
}

async function recount(db: NavillDB) {
  const counts = countsFromEvents(await db.openEvents.toArray());
  await db.transaction('rw', db.bookmarks, async () => {
    for (const [id, c] of counts) await db.bookmarks.update(id, c);
  });
}

/** 设置页：删除云端全部 Navill 数据 */
export async function deleteRemoteData(db: NavillDB) {
  const files: DriveFile[] = await listFiles();
  for (const f of files) await remove(f.id);
  for (const k of ['remoteStateModified', 'eventsUploaded', 'eventsSeen']) await db.meta.delete(k);
}

export type { SyncEntity };
