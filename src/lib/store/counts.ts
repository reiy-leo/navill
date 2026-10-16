import type { NavillDB, Visit } from '@/src/db';
import { countsFromEvents } from '../sync/merge';

/** 打开次数 = max(从 Navill 打开的次数, 本机浏览记录访问次数) */
export async function recount(db: NavillDB) {
  const ev = countsFromEvents(await db.openEvents.toArray());
  const vis = new Map((await db.visits.toArray()).map((v) => [v.bookmarkId, v]));
  await db.transaction('rw', db.bookmarks, async () => {
    for (const id of new Set([...ev.keys(), ...vis.keys()])) {
      const e = ev.get(id);
      const v = vis.get(id);
      const last = Math.max(e?.lastOpenedAt ?? 0, v?.lastAt ?? 0);
      await db.bookmarks.update(id, { openCount: Math.max(e?.openCount ?? 0, v?.count ?? 0), lastOpenedAt: last || undefined });
    }
  });
}

/** 网址比较时忽略 #片段、末尾斜杠和域名大小写 */
export function normUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.href.replace(/\/$/, '');
  } catch {
    return url.replace(/#.*$/, '').replace(/\/$/, '');
  }
}

const SEED_EVERY = 6 * 3600_000;

/**
 * 读本机浏览记录，统计每个书签网址的访问次数。需要「浏览记录」权限，没授权就跳过。
 * 清除过打开记录后，只统计清除之后的访问。
 */
export async function seedFromHistory(db: NavillDB, force = false): Promise<number> {
  if (!browser.history || !(await browser.permissions.contains({ permissions: ['history'] }).catch(() => false))) return 0;
  const seededAt = (await db.meta.get('historySeededAt'))?.value as number | undefined;
  if (!force && seededAt && Date.now() - seededAt < SEED_EVERY) return 0;
  const since = ((await db.meta.get('countsClearedAt'))?.value as number | undefined) ?? 0;
  const items = await browser.history.search({ text: '', startTime: since, maxResults: 1_000_000 });
  const hist = new Map<string, { url: string; count: number; lastAt: number }>();
  for (const h of items) {
    if (!h.url) continue;
    const k = normUrl(h.url);
    const prev = hist.get(k);
    hist.set(k, { url: h.url, count: (prev?.count ?? 0) + (h.visitCount ?? 0), lastAt: Math.max(prev?.lastAt ?? 0, h.lastVisitTime ?? 0) });
  }
  const rows: Visit[] = [];
  for (const b of await db.bookmarks.toArray()) {
    const h = hist.get(normUrl(b.url));
    if (!h) continue;
    let count = h.count;
    if (since) count = (await browser.history.getVisits({ url: h.url })).filter((v) => (v.visitTime ?? 0) >= since).length;
    if (count > 0) rows.push({ bookmarkId: b.id, count, lastAt: h.lastAt });
  }
  await db.transaction('rw', db.visits, db.meta, async () => {
    await db.visits.clear();
    await db.visits.bulkPut(rows);
    await db.meta.put({ key: 'historySeededAt', value: Date.now() });
  });
  await recount(db);
  return rows.length;
}

/** 关闭浏览记录权限时：去掉浏览记录打底的次数 */
export async function clearVisits(db: NavillDB) {
  await db.visits.clear();
  await db.meta.delete('historySeededAt');
  await db.bookmarks.toCollection().modify({ openCount: 0, lastOpenedAt: undefined });
  await recount(db);
}
