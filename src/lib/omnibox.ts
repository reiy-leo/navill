import { db } from '@/src/db';
import { getSettings } from './settings';
import { recordOpen } from './store';
import { search, visibilityOf } from './view';

import { tr } from '@/src/i18n';
/** 地址栏输入 nv + 空格，搜索 Navill 里的书签和关联链接 */
const MAX = 8;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

interface Target { url: string; bookmarkId: string; placementId: string }
let last: Target[] = [];

async function find(text: string): Promise<{ t: Target; title: string; where: string }[]> {
  const s = await getSettings();
  const v = visibilityOf(await db.modes.get(s.currentModeId));
  const words = text.trim().toLowerCase().split(/\s+/).filter((w) => w && !w.startsWith('#'));
  const out: { t: Target; title: string; where: string }[] = [];
  for (const h of await search(db, text, v, MAX)) {
    const b = h.item.bookmark;
    const base = { bookmarkId: b.id, placementId: h.item.placement.id };
    const where = [h.workspace.name, h.drawer?.name].filter(Boolean).join(' / ');
    out.push({ t: { ...base, url: b.url }, title: b.title || b.url, where });
    for (const l of b.links ?? []) {
      const hay = `${l.title ?? ''} ${l.url}`.toLowerCase();
      if (words.length && words.every((w) => hay.includes(w))) out.push({ t: { ...base, url: l.url }, title: `${b.title} · ${l.title || l.url}`, where });
    }
    if (out.length >= MAX) break;
  }
  return out.slice(0, MAX);
}

export function setupOmnibox() {
  if (!browser.omnibox) return;
  browser.omnibox.setDefaultSuggestion({ description: tr('在 Navill 中搜索：<match>%s</match>') });
  browser.omnibox.onInputChanged.addListener((text, suggest) => {
    void find(text).then((rs) => {
      last = rs.map((r) => r.t);
      suggest(rs.map((r) => ({
        content: r.t.url,
        description: `${esc(r.title)} <dim>${esc(r.where)}</dim> <url>${esc(r.t.url)}</url>`,
      })));
    }).catch(() => suggest([]));
  });
  browser.omnibox.onInputEntered.addListener((text, disposition) => {
    void (async () => {
      let t = last.find((x) => x.url === text);
      if (!t) t = (await find(text))[0]?.t;
      if (!t) return;
      await recordOpen(db, t.bookmarkId, t.placementId).catch(() => {});
      if (disposition === 'currentTab') {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) await browser.tabs.update(tab.id, { url: t.url });
        else await browser.tabs.create({ url: t.url });
      } else {
        await browser.tabs.create({ url: t.url, active: disposition === 'newForegroundTab' });
      }
    })();
  });
}
