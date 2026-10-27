import type { Bookmark, NavillDB } from '@/src/db';
import { getShareToken, invalidateShareToken } from '@/src/lib/sync/auth';
import { httpGloss } from '@/src/lib/sync/http';
import { loadWorkspace, sortItems, type Item } from '@/src/lib/view';
import { createBookmark, createDrawer, createWorkspace, placeDrawerInSection, updateBookmark } from '@/src/lib/store';

import { tr } from '@/src/i18n';
/**
 * 分享到 navill.rei8t.dev。协议见 navill-web 仓库 docs/SHARE_API.md。
 * 只上传展示用字段：标题、链接、备注、关联链接；不带打开次数、时间戳、标签、场景、分身关系。
 */
export const SHARE_ORIGIN = 'https://navill.rei8t.dev';

export type ShareKind = 'workspace' | 'drawer';
export interface MyShare {
  id: string; kind: ShareKind; sourceId: string; title: string; url: string;
  status: 'live' | 'pending' | 'rejected' | 'taken_down';
  liveVersion: number | null; pendingVersion: number | null; rejectedNote?: string | null; updatedAt: number;
}
interface ShareBookmark { title: string; url: string; note?: string; links?: { url: string; title?: string }[] }
export interface SharePayload {
  v: 1; kind: ShareKind; author?: string; description?: string;
  workspace: { name: string; emoji?: string; color?: string };
  loose?: ShareBookmark[];
  drawers: { name: string; bookmarks: ShareBookmark[] }[];
}

export const STATUS_LABEL: Record<MyShare['status'], string> = {
  live: tr('已公开'), pending: tr('审核中'), rejected: tr('未通过'), taken_down: tr('已下架'),
};

async function call<T>(method: string, path: string, body?: unknown, retried = false, interactive = true): Promise<T> {
  const token = await getShareToken(interactive);
  const res = await fetch(SHARE_ORIGIN + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !retried) {
    await invalidateShareToken();
    return call(method, path, body, true, interactive);
  }
  if (res.status === 204) return undefined as T;
  return parse<T>(res);
}

/** 解析响应：失败时优先用服务端给的 error，否则用带中文释义的状态码 */
async function parse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || httpGloss(res.status));
  return data as T;
}

export const listShares = (interactive = true) => call<{ shares: MyShare[] }>('GET', '/api/ext/shares', undefined, false, interactive).then((r) => r.shares);
export const putShare = (kind: ShareKind, sourceId: string, payload: SharePayload) =>
  call<{ share: MyShare }>('PUT', '/api/ext/shares', { kind, sourceId, payload }).then((r) => r.share);
export const deleteShare = (id: string) => call<void>('DELETE', `/api/ext/shares/${encodeURIComponent(id)}`);

const isWeb = (u: string) => /^https?:\/\//i.test(u);
const toShare = (b: Bookmark): ShareBookmark | null => {
  if (!isWeb(b.url)) return null;
  const links = (b.links ?? []).filter((l) => isWeb(l.url)).map((l) => ({ url: l.url, ...(l.title ? { title: l.title } : {}) }));
  return { title: b.title, url: b.url, ...(b.note ? { note: b.note } : {}), ...(links.length ? { links } : {}) };
};

/** 生成快照。默认排除 18+ 抽屉和带 18+ 标签的书签；分身与挂载的书签展开成普通书签；归档的不分享。 */
export async function buildPayload(
  db: NavillDB, kind: ShareKind, sourceId: string,
  opts: { includeAdult: boolean; author?: string; description?: string },
): Promise<{ payload: SharePayload; count: number }> {
  const workspaceId = kind === 'workspace' ? sourceId : (await db.drawers.get(sourceId))?.workspaceId;
  if (!workspaceId) throw new Error(tr('找不到要分享的内容'));
  const data = await loadWorkspace(db, workspaceId, { hiddenWorkspaces: new Set(), hiddenDrawers: new Set(), showAdult: opts.includeAdult });
  if (!data) throw new Error(tr('找不到要分享的内容'));
  let count = 0;
  const pick = (items: Item[]) => items.flatMap((i) => { const b = toShare(i.bookmark); if (b) count++; return b ? [b] : []; });
  const drawers = data.drawers
    .filter((d) => kind === 'workspace' || d.drawer.id === sourceId)
    .map((d) => ({ name: d.drawer.name, bookmarks: pick([...d.items, ...d.mounted]) }));
  if (kind === 'drawer' && !drawers.length) throw new Error(opts.includeAdult ? tr('找不到这个抽屉') : tr('18+ 抽屉不能分享'));
  const w = data.workspace;
  if (kind === 'workspace' && w.adult && !opts.includeAdult) throw new Error(tr('18+ 工作区不能分享'));
  const payload: SharePayload = {
    v: 1, kind,
    ...(opts.author?.trim() ? { author: opts.author.trim() } : {}),
    ...(opts.description?.trim() ? { description: opts.description.trim() } : {}),
    workspace: { name: w.name, ...(w.emoji ? { emoji: w.emoji } : {}), ...(w.color && /^#[0-9a-f]{6}$/i.test(w.color) ? { color: w.color } : {}) },
    ...(kind === 'workspace' ? { loose: pick(sortItems(data.top)) } : {}),
    drawers,
  };
  return { payload, count };
}


/** 市场：审核通过的公开分享，不需要登录 */
export interface PublicShare {
  id: string; kind: ShareKind; title: string; author: string; description?: string; emoji?: string; color?: string;
  bookmarkCount: number; drawerCount: number; publishedAt: number;
}
export interface PublicShareDetail extends PublicShare { payload: SharePayload }

const pub = async <T>(path: string): Promise<T> => parse<T>(await fetch(SHARE_ORIGIN + path));
export const listPublicShares = (cursor?: string | null) =>
  pub<{ items: PublicShare[]; nextCursor: string | null }>(`/api/shares${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
export const getPublicShare = (id: string) => pub<PublicShareDetail>(`/api/shares/${encodeURIComponent(id)}`);
export const shareUrl = (id: string) => `${SHARE_ORIGIN}/s/${id}`;

/** 市场：把分享里的一个抽屉安装到指定工作区（新建抽屉 + 书签，含关联链接） */
export async function installSharedDrawer(db: NavillDB, workspaceId: string, drawer: { name: string; bookmarks: ShareBookmark[] }, sectionId?: string | null) {
  const d = await createDrawer(db, workspaceId, drawer.name);
  if (sectionId) await placeDrawerInSection(db, d.id, sectionId, []);
  for (const b of drawer.bookmarks) {
    const { bookmark } = await createBookmark(db, { url: b.url, title: b.title, note: b.note }, workspaceId, d.id);
    if (b.links?.length) await updateBookmark(db, bookmark.id, { links: b.links });
  }
  return d;
}

/** 市场：把整个工作区分享安装成一个新工作区（零散书签放进以工作区名命名的抽屉） */
export async function installSharedWorkspace(db: NavillDB, payload: SharePayload, name: string) {
  const ws = await createWorkspace(db, { name, emoji: payload.workspace.emoji, color: payload.workspace.color, description: payload.description });
  if (payload.loose?.length) await installSharedDrawer(db, ws.id, { name, bookmarks: payload.loose });
  for (const d of payload.drawers) await installSharedDrawer(db, ws.id, d);
  return ws;
}
