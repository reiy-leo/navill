import { db } from '@/src/db';
import { ensureSeed } from '@/src/lib/store/seed';
import { parseWorkspaceIcons } from '@/src/lib/store/workspace';

/** 每次启动/更新：把工作区名称里的 emoji 提取为图标 */
const fixIcons = () => parseWorkspaceIcons(db).catch((e) => console.warn('[Navill] 解析工作区图标失败', e));
import { getSettings, settingsItem } from '@/src/lib/settings';
import { backoffMinutes, syncNow } from '@/src/lib/sync/engine';
import { logInstallOnce } from '@/src/lib/log';
import { setupOmnibox } from '@/src/lib/omnibox';

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
  setupOmnibox();
  browser.runtime.onInstalled.addListener(async ({ reason }) => {
    await ensureSeed(db);
    // 新设备 / 新浏览器：首次安装时记一条日志（每台设备只记一次）
    if (reason === 'install') await logInstallOnce(db).catch(() => {});
    await fixIcons();
    await schedule();
    if (reason === 'install') void browser.tabs.create({ url: browser.runtime.getURL('/newtab.html') });
  });
  browser.runtime.onStartup.addListener(async () => {
    await fixIcons();
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
