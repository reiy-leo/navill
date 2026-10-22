import { SYNC_ENTITIES, type LogEntry, type NavillDB, type OpenEvent } from '@/src/db';
import { snapshot } from '../io/backup';
import { deviceId } from '../store/core';
import { ensureSeed, mergeInboxes } from '../store/seed';
import { recount } from '../store/counts';
import { applyRemoteSettings, getSettings, settingsModifiedItem, syncedPart, syncStatusItem } from '../settings';
import { signIn } from './auth';
import { gunzip, gzip } from './drive';
import { backend, connectWebdav, disconnect, isConnected, syncProviderItem, type Backend, type RemoteFile } from './backend';
import { HttpError } from './http';
import type { WebdavConfig } from './webdav';
import { mergeStates, type RemoteState } from './merge';
import { addLog, groupByMonth } from '../log';

import { tr } from '@/src/i18n';
const STATE_FILE = 'state.json.gz';
const SETTINGS_FILE = 'settings.json.gz';

let running: Promise<void> | null = null;

/** 立即同步（同一时刻只跑一个） */
export function syncNow(db: NavillDB): Promise<void> {
  running ??= runWithRetry(db).finally(() => {
    running = null;
  });
  return running;
}

/** WebDAV 上传遇到 412（别的设备刚写过）时立即重新拉取合并一次 */
async function runWithRetry(db: NavillDB) {
  try {
    await run(db);
  } catch (e) {
    if (e instanceof HttpError && e.status === 412) return run(db);
    throw e;
  }
}

async function run(db: NavillDB) {
  if (!(await isConnected())) {
    await syncStatusItem.setValue({ state: 'signed-out' });
    return;
  }
  const prev = await syncStatusItem.getValue();
  await syncStatusItem.setValue({ ...prev, state: 'syncing', message: undefined });
  try {
    await ensureSeed(db);
    const dev = await deviceId(db);
    const be = await backend();
    const { download, upload } = be;
    const files = await be.listFiles();
    const byName = new Map(files.map((f) => [f.name, f]));

    // 1. 结构：拉取远端 state，合并，写回本地，再上传合并结果
    const stateFile = byName.get(STATE_FILE);
    let remote: RemoteState | undefined;
    const lastSeen = (await db.meta.get('remoteStateModified'))?.value as string | undefined;
    const outboxCount = await db.outbox.count();
    if (stateFile && stateFile.modifiedTime !== lastSeen) {
      remote = JSON.parse(await gunzip(await download(stateFile))) as RemoteState;
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
      const saved = await upload(STATE_FILE, await gzip(JSON.stringify(state)), stateFile);
      await db.meta.put({ key: 'remoteStateModified', value: saved.modifiedTime });
      await db.outbox.clear();
    }

    // 1b. 设置：整体比较修改时间，新的一方覆盖另一方（本机项不同步）
    await syncSettings(db, be, byName.get(SETTINGS_FILE));

    // 2. 使用统计：每台设备只写自己的月度事件文件，读取其他设备变化过的文件
    const mine = await db.openEvents.where('deviceId').equals(dev).toArray();
    const pulled = await syncDeviceFiles(db, be, files, byName, {
      dir: 'events', dev, months: groupByMonth(mine, (e) => e.openedAt),
      put: (rows) => db.openEvents.bulkPut(rows as OpenEvent[]),
    });
    if (pulled) await recount(db);
    // 3. 日志（可选）：同上，下载时按 id 合并
    if ((await getSettings()).sync.logs) {
      const logs = await db.logs.where('deviceId').equals(dev).toArray();
      await syncDeviceFiles(db, be, files, byName, {
        dir: 'logs', dev, months: groupByMonth(logs, (e) => e.at),
        put: (rows) => db.logs.bulkPut(rows as LogEntry[]),
      });
    }

    await syncStatusItem.setValue({ state: 'ok', lastSyncAt: Date.now() });
    await db.meta.put({ key: 'syncFailures', value: 0 });
  } catch (e) {
    const failures = Number((await db.meta.get('syncFailures'))?.value ?? 0) + 1;
    await db.meta.put({ key: 'syncFailures', value: failures });
    if (!(e instanceof HttpError && e.status === 412 && failures === 1)) await syncStatusItem.setValue({ ...prev, state: 'error', message: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

async function syncSettings(db: NavillDB, { download, upload }: Backend, file: RemoteFile | undefined) {
  const localAt = await settingsModifiedItem.getValue();
  const lastSeen = (await db.meta.get('settingsRemoteModified'))?.value as string | undefined;
  let remoteAt = ((await db.meta.get('settingsRemoteSavedAt'))?.value as number | undefined) ?? 0;
  if (file && file.modifiedTime !== lastSeen) {
    const remote = JSON.parse(await gunzip(await download(file))) as { savedAt: number; settings: Record<string, unknown> };
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
  const saved = await upload(SETTINGS_FILE, await gzip(JSON.stringify(body)), file);
  await db.meta.put({ key: 'settingsRemoteModified', value: saved.modifiedTime });
  await db.meta.put({ key: 'settingsRemoteSavedAt', value: savedAt });
}

/**
 * 按设备分月的 jsonl 文件（`{dir}/{设备}-{月}.jsonl.gz`）：上传本机条数有变化的月份，下载其他设备变化过的文件。
 * 进度记在 meta 的 `{dir}Uploaded`（每月已传条数）和 `{dir}Seen`（已读文件的修改时间）。返回是否拉到了新文件。
 */
async function syncDeviceFiles(
  db: NavillDB, { download, upload }: Backend, files: RemoteFile[], byName: Map<string, RemoteFile>,
  o: { dir: 'events' | 'logs'; dev: string; months: Map<string, unknown[]>; put: (rows: unknown[]) => Promise<unknown> },
): Promise<boolean> {
  const uploaded = ((await db.meta.get(`${o.dir}Uploaded`))?.value ?? {}) as Record<string, number>;
  for (const [month, rows] of o.months) {
    if (uploaded[month] === rows.length) continue;
    const name = `${o.dir}/${o.dev}-${month}.jsonl.gz`;
    await upload(name, await gzip(rows.map((r) => JSON.stringify(r)).join('\n')), byName.get(name));
    uploaded[month] = rows.length;
  }
  await db.meta.put({ key: `${o.dir}Uploaded`, value: uploaded });

  const seen = ((await db.meta.get(`${o.dir}Seen`))?.value ?? {}) as Record<string, string>;
  let pulled = false;
  for (const f of files) {
    if (!f.name.startsWith(`${o.dir}/`) || f.name.startsWith(`${o.dir}/${o.dev}-`)) continue;
    if (seen[f.name] === f.modifiedTime) continue;
    const lines = (await gunzip(await download(f))).split('\n').filter(Boolean);
    await o.put(lines.map((l) => JSON.parse(l)));
    seen[f.name] = f.modifiedTime;
    pulled = true;
  }
  await db.meta.put({ key: `${o.dir}Seen`, value: seen });
  return pulled;
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

/** 连接 WebDAV 并记一条日志（会先断开 Google） */
export async function connectWebdavAndLog(db: NavillDB, cfg: WebdavConfig) {
  if ((await syncProviderItem.getValue()) !== 'webdav') await disconnectSync(db);
  await connectWebdav(cfg);
  await addLog(db, { kind: 'signin', targetType: 'sync', summary: tr('连接 WebDAV 同步：{0}', new URL(cfg.url).host) });
}

/** 设置页：删除云端全部 Navill 数据 */
export async function deleteRemoteData(db: NavillDB) {
  const be = await backend();
  for (const f of await be.listFiles()) await be.remove(f);
  await resetRemoteMeta(db);
}

/** 清除「云端看到/上传到哪」的记录：删除云端数据或切换同步目标后，下次同步完整上传 */
async function resetRemoteMeta(db: NavillDB) {
  for (const k of ['remoteStateModified', 'eventsUploaded', 'eventsSeen', 'logsUploaded', 'logsSeen', 'settingsRemoteModified', 'settingsRemoteSavedAt']) await db.meta.delete(k);
}

/** 断开同步目标（Google 退出 / 清除 WebDAV 凭据），并重置云端记录以便换目标 */
export async function disconnectSync(db: NavillDB) {
  await disconnect();
  await resetRemoteMeta(db);
}

/** 登录 Google 并记一条日志 */
export async function signInAndLog(db: NavillDB) {
  if ((await syncProviderItem.getValue()) !== 'google') {
    await disconnectSync(db);
    await syncProviderItem.setValue('google');
  }
  await signIn();
  await addLog(db, { kind: 'signin', targetType: 'sync', summary: tr('登录 Google Drive 同步') });
}
