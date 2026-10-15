import type { Bookmark, NavillDB } from '@/src/db';
import { getShareToken, invalidateShareToken } from '@/src/lib/sync/auth';
import { loadWorkspace, sortItems, type Item } from '@/src/lib/view';

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
  live: '已公开', pending: '审核中', rejected: '未通过', taken_down: '已下架',
};

const HTTP_GLOSS: Record<number, string> = {
  401: '401 未授权', 403: '403 禁止访问', 409: '409 冲突', 413: '413 内容太大', 422: '422 无法处理', 429: '429 请求太频繁', 500: '500 服务器错误', 502: '502 网关错误', 503: '503 服务不可用',
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || HTTP_GLOSS[res.status] || `${res.status} 请求失败`);
  return data as T;
}

export const listShares = (interactive = true) => call<{ shares: MyShare[] }>('GET', '/api/ext/shares', undefined, false, interactive).then((r) => r.shares);
export const findShare = async (kind: ShareKind, sourceId: string) => (await listShares()).find((s) => s.kind === kind && s.sourceId === sourceId) ?? null;
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
  if (!workspaceId) throw new Error('找不到要分享的内容');
  const data = await loadWorkspace(db, workspaceId, { hiddenWorkspaces: new Set(), hiddenDrawers: new Set(), showAdult: opts.includeAdult });
  if (!data) throw new Error('找不到要分享的内容');
  let count = 0;
  const pick = (items: Item[]) => items.flatMap((i) => { const b = toShare(i.bookmark); if (b) count++; return b ? [b] : []; });
  const drawers = data.drawers
    .filter((d) => kind === 'workspace' || d.drawer.id === sourceId)
    .map((d) => ({ name: d.drawer.name, bookmarks: pick([...d.items, ...d.mounted]) }));
  if (kind === 'drawer' && !drawers.length) throw new Error(opts.includeAdult ? '找不到这个抽屉' : '这是 18+ 抽屉，勾选「包含 18+ 内容」才能分享');
  const w = data.workspace;
  if (kind === 'workspace' && w.adult && !opts.includeAdult) throw new Error('这是 18+ 工作区，勾选「包含 18+ 内容」才能分享');
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

