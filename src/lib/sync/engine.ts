import { SYNC_ENTITIES, type LogEntry, type NavillDB, type OpenEvent, type SyncEntity } from '@/src/db';
import { snapshot } from '../io/backup';
import { deviceId } from '../store/core';
import { ensureSeed, mergeInboxes } from '../store/seed';
import { applyRemoteSettings, getSettings, settingsModifiedItem, syncedPart, syncStatusItem } from '../settings';
import { isConfigured, isSignedIn, signIn } from './auth';
import { download, gunzip, gzip, listFiles, remove, upload, type DriveFile } from './drive';
import { countsFromEvents, mergeStates, monthKey, type RemoteState } from './merge';
import { addLog, groupByMonth } from '../log';

const STATE_FILE = 'state.json.gz';
const SETTINGS_FILE = 'settings.json.gz';
const eventsFile = (dev: string, month: string) => `events/${dev}-${month}.jsonl.gz`;
const logsFile = (dev: string, month: string) => `logs/${dev}-${month}.jsonl.gz`;

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
      // 各设备各自建的「待整理」合并成一个（合并产生的改动随下面一起上传）
      if ((await db.workspaces.where('source').equals('inbox').count()) > 1) {
        await mergeInboxes(db);
        m.merged = await snapshot(db);
        m.tombstones = await db.tombstones.toArray();
      }
      const state: RemoteState = { format: 'navill-state', version: 2, savedAt: Date.now(), deviceId: dev, data: m.merged, tombstones: m.tombstones };
      const saved = await upload(STATE_FILE, await gzip(JSON.stringify(state)), stateFile?.id);
      await db.meta.put({ key: 'remoteStateModified', value: saved.modifiedTime });
      await db.outbox.clear();
    }

    // 1b. 设置：整体比较修改时间，新的一方覆盖另一方（本机项不同步）
    await syncSettings(db, byName.get(SETTINGS_FILE));

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
    // 3. 日志（可选）：与使用统计相同，每台设备只追加自己的月度文件，下载时按 id 合并
    if ((await getSettings()).sync.logs) await syncLogs(db, dev, files, byName);

    await syncStatusItem.setValue({ state: 'ok', lastSyncAt: Date.now() });
    await db.meta.put({ key: 'syncFailures', value: 0 });
  } catch (e) {
    const failures = Number((await db.meta.get('syncFailures'))?.value ?? 0) + 1;
    await db.meta.put({ key: 'syncFailures', value: failures });
    await syncStatusItem.setValue({ ...prev, state: 'error', message: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

async function syncSettings(db: NavillDB, file: DriveFile | undefined) {
  const localAt = await settingsModifiedItem.getValue();
  const lastSeen = (await db.meta.get('settingsRemoteModified'))?.value as string | undefined;
  let remoteAt = ((await db.meta.get('settingsRemoteSavedAt'))?.value as number | undefined) ?? 0;
  if (file && file.modifiedTime !== lastSeen) {
    const remote = JSON.parse(await gunzip(await download(file.id))) as { savedAt: number; settings: Record<string, unknown> };
    remoteAt = remote.savedAt;
    await db.meta.put({ key: 'settingsRemoteModified', value: file.modifiedTime });
    await db.meta.put({ key: 'settingsRemoteSavedAt', value: remoteAt });
    if (remoteAt > localAt) {
      await applyRemoteSettings(remote.settings, remoteAt);
      return;
    }
  }
  if (file && localAt <= remoteAt) return;
  const savedAt = localAt || Date.now();
  const body = { format: 'navill-settings', version: 1, savedAt, settings: syncedPart(await getSettings()) };
  const saved = await upload(SETTINGS_FILE, await gzip(JSON.stringify(body)), file?.id);
  await db.meta.put({ key: 'settingsRemoteModified', value: saved.modifiedTime });
  await db.meta.put({ key: 'settingsRemoteSavedAt', value: savedAt });
}

async function syncLogs(db: NavillDB, dev: string, files: DriveFile[], byName: Map<string, DriveFile>) {
  const mine = await db.logs.where('deviceId').equals(dev).toArray();
  const months = groupByMonth(mine);
  const uploaded = ((await db.meta.get('logsUploaded'))?.value ?? {}) as Record<string, number>;
  for (const [month, logs] of months) {
    if (uploaded[month] === logs.length) continue;
    const name = logsFile(dev, month);
    await upload(name, await gzip(logs.map((e) => JSON.stringify(e)).join('\n')), byName.get(name)?.id);
    uploaded[month] = logs.length;
  }
  await db.meta.put({ key: 'logsUploaded', value: uploaded });
  const seen = ((await db.meta.get('logsSeen'))?.value ?? {}) as Record<string, string>;
  for (const f of files) {
    if (!f.name.startsWith('logs/') || f.name.startsWith(`logs/${dev}-`)) continue;
    if (seen[f.name] === f.modifiedTime) continue;
    const lines = (await gunzip(await download(f.id))).split('\n').filter(Boolean);
    await db.logs.bulkPut(lines.map((l) => JSON.parse(l) as LogEntry));
    seen[f.name] = f.modifiedTime;
  }
  await db.meta.put({ key: 'logsSeen', value: seen });
}

/** 待上传的改动数：结构改动（outbox）+ 开启日志同步时未上传的本机日志 */
export async function pendingChanges(db: NavillDB): Promise<number> {
  let n = await db.outbox.count();
  if ((await getSettings()).sync.logs) {
    const dev = await deviceId(db);
    const uploaded = ((await db.meta.get('logsUploaded'))?.value ?? {}) as Record<string, number>;
    const total = await db.logs.where('deviceId').equals(dev).count();
    n += Math.max(0, total - Object.values(uploaded).reduce((a, b) => a + b, 0));
  }
  return n;
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
  for (const k of ['remoteStateModified', 'eventsUploaded', 'eventsSeen', 'logsUploaded', 'logsSeen', 'settingsRemoteModified', 'settingsRemoteSavedAt']) await db.meta.delete(k);
}

export type { SyncEntity };

/** 登录 Google 并记一条日志 */
export async function signInAndLog(db: NavillDB) {
  await signIn();
  await addLog(db, { kind: 'signin', targetType: 'sync', summary: '登录 Google Drive 同步' });
}
