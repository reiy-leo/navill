import { db } from '@/src/db';
import { ensureSeed } from '@/src/lib/store/seed';
import { getSettings, settingsItem } from '@/src/lib/settings';
import { backoffMinutes, syncNow } from '@/src/lib/sync/engine';

const ALARM = 'navill-sync';

async function schedule() {
  const s = await getSettings();
  await browser.alarms.clear(ALARM);
  if (s.sync.enabled && s.sync.intervalMinutes > 0) {
    await browser.alarms.create(ALARM, { periodInMinutes: s.sync.intervalMinutes });
  }
}

async function trySync(reason: string) {
  const s = await getSettings();
  if (!s.sync.enabled) return;
  try {
    await syncNow(db);
  } catch (e) {
    const wait = await backoffMinutes(db);
    console.warn(`[Navill] 同步失败（${reason}），${wait} 分钟后重试`, e);
    if (wait > 0) await browser.alarms.create(`${ALARM}-retry`, { delayInMinutes: wait });
  }
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async ({ reason }) => {
    await ensureSeed(db);
    await schedule();
    if (reason === 'install') void browser.tabs.create({ url: browser.runtime.getURL('/newtab.html') });
  });
  browser.runtime.onStartup.addListener(async () => {
    await schedule();
    void trySync('启动');
  });
  browser.alarms.onAlarm.addListener((a) => {
    if (a.name === ALARM || a.name === `${ALARM}-retry`) void trySync('定时');
  });
  settingsItem.watch(() => void schedule());
  browser.runtime.onMessage.addListener((msg: { type?: string }, _sender, sendResponse) => {
    if (msg?.type === 'sync-now') {
      syncNow(db).then(
        () => sendResponse({ ok: true }),
        (e: unknown) => sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      );
      return true;
    }
    return undefined;
  });
});
