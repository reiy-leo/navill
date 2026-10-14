export default defineBackground(() => {
  // M5：chrome.alarms 每 15 分钟批量把 Outbox 同步到 Google Drive
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') {
      void browser.tabs.create({ url: browser.runtime.getURL('/newtab.html') });
    }
  });
});
