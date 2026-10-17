import type { NavillDB } from '@/src/db';
import type { BookmarkNode } from '../edge-workspace';

import { tr } from '@/src/i18n';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 导出标准 Netscape 书签 HTML：工作区 → 文件夹，抽屉 → 子文件夹（按路径还原层级） */
export async function exportNetscapeHtml(db: NavillDB): Promise<string> {
  const [workspaces, drawers, placements, bookmarks] = await Promise.all([
    db.workspaces.orderBy('order').toArray(), db.drawers.toArray(), db.placements.toArray(), db.bookmarks.toArray(),
  ]);
  const bm = new Map(bookmarks.map((b) => [b.id, b]));
  const line = (b: { url: string; title: string; createdAt: number }, ind: string) =>
    `${ind}<DT><A HREF="${esc(b.url)}" ADD_DATE="${Math.floor(b.createdAt / 1000)}">${esc(b.title)}</A>\n`;
  const items = (ps: typeof placements, ind: string) =>
    ps.sort((a, b) => a.order - b.order).map((p) => bm.get(p.bookmarkId)).filter((b) => b && !b.archivedAt).map((b) => line(b!, ind) + (b!.links ?? []).map((l) => line({ url: l.url, title: `${b!.title} · ${l.title || hostOfUrl(l.url)}`, createdAt: b!.createdAt }, ind)).join('')).join('');

  let out = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n';
  for (const w of workspaces) {
    out += `    <DT><H3>${esc(w.emoji ? `${w.emoji} ${w.name}` : w.name)}</H3>\n    <DL><p>\n`;
    out += items(placements.filter((p) => p.workspaceId === w.id && p.drawerId === null), '        ');
    for (const d of drawers.filter((x) => x.workspaceId === w.id).sort((a, b) => a.order - b.order)) {
      out += `        <DT><H3>${esc(d.name)}</H3>\n        <DL><p>\n`;
      out += items(placements.filter((p) => p.drawerId === d.id), '            ');
      out += '        </DL><p>\n';
    }
    out += '    </DL><p>\n';
  }
  return `${out}</DL><p>\n`;
}

/**
 * 解析 Netscape 书签 HTML 为书签树，根下放一个「书签栏」节点（id '1'），
 * 以便复用首次导入的规则：顶级文件夹 → 工作区，散放书签 → 待整理。
 */
export function parseNetscapeHtml(html: string): BookmarkNode {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let seq = 0;
  const id = () => `html-${++seq}`;
  const walk = (dl: Element): BookmarkNode[] => {
    const out: BookmarkNode[] = [];
    for (const dt of Array.from(dl.children)) {
      if (dt.tagName !== 'DT') continue;
      const a = dt.querySelector(':scope > a');
      const h3 = dt.querySelector(':scope > h3');
      if (a) {
        const add = Number(a.getAttribute('add_date'));
        out.push({ id: id(), title: a.textContent ?? '', url: a.getAttribute('href') ?? '', dateAdded: add ? add * 1000 : undefined, syncing: false } as BookmarkNode);
      } else if (h3) {
        const sub = dt.querySelector(':scope > dl') ?? (dt.nextElementSibling?.tagName === 'DL' ? dt.nextElementSibling : null);
        out.push({ id: id(), title: h3.textContent ?? '', children: sub ? walk(sub) : [], syncing: false } as BookmarkNode);
      }
    }
    return out;
  };
  const top = doc.querySelector('dl');
  // 解析器会把 <p> 等标签挪动，DT 有时被包在 <p> 里：先把 DL 下的 P 展开
  doc.querySelectorAll('dl > p').forEach((p) => p.replaceWith(...Array.from(p.childNodes)));
  const children = top ? walk(top) : [];
  const bar = { id: '1', title: tr('书签栏'), children, syncing: false } as BookmarkNode;
  return { id: '0', title: '', children: [bar], syncing: false } as BookmarkNode;
}

function hostOfUrl(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}
