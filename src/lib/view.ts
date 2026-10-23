import { MODE_DEFAULT, TAG_ADULT, type AliasGroup, type Bookmark, type Drawer, type Mode, type NavillDB, type Placement, type SortMode, type Tag, type ViewMode, type Workspace } from '@/src/db';
import { localizeNames } from '@/src/lib/presetNames';

export interface Item { placement: Placement; bookmark: Bookmark; mountedFrom?: { group: AliasGroup; drawer: Drawer } }

export interface Visibility {
  hiddenWorkspaces: Set<string>;
  hiddenDrawers: Set<string>;
  showAdult: boolean;
  includeArchived?: boolean;
}

export function visibilityOf(mode: Mode | undefined, includeArchived = false): Visibility {
  const isDefault = !mode || mode.id === MODE_DEFAULT;
  return {
    hiddenWorkspaces: new Set(isDefault ? [] : mode.hiddenWorkspaceIds),
    hiddenDrawers: new Set(isDefault ? [] : mode.hiddenDrawerIds),
    showAdult: mode?.showAdult ?? false,
    includeArchived,
  };
}

export const workspaceVisible = (w: Workspace, v: Visibility) => !v.hiddenWorkspaces.has(w.id) && (v.showAdult || !w.adult);
export const drawerVisible = (d: Drawer, v: Visibility) =>
  !v.hiddenDrawers.has(d.id) && (v.showAdult || !d.adult) && (v.includeArchived || !d.archivedAt);
export const bookmarkVisible = (b: Bookmark, v: Visibility) =>
  (v.includeArchived || !b.archivedAt) && (v.showAdult || !b.tagIds.includes(TAG_ADULT));

const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });

const DAY = 86_400_000;
/** 智能排序得分：点击次数 × 新近系数。30 天内打开过不打折，之后每 30 天减半，最低保留 1/4 */
export function smartScore(b: Bookmark, now = Date.now()): number {
  if (!b.openCount) return 0;
  const idle = b.lastOpenedAt ? Math.max(0, now - b.lastOpenedAt - 30 * DAY) : 0;
  return b.openCount * Math.max(0.25, 0.5 ** (idle / (30 * DAY)));
}

export function sortItems(items: Item[], mode: SortMode = 'manual', now = Date.now()): Item[] {
  const list = [...items];
  switch (mode) {
    case 'smart':
      return list.sort((a, b) => smartScore(b.bookmark, now) - smartScore(a.bookmark, now) || (b.bookmark.lastOpenedAt ?? 0) - (a.bookmark.lastOpenedAt ?? 0) || a.placement.order - b.placement.order);
    case 'name-asc':
      return list.sort((a, b) => collator.compare(a.bookmark.title, b.bookmark.title));
    case 'name-desc':
      return list.sort((a, b) => collator.compare(b.bookmark.title, a.bookmark.title));
    case 'clicks-asc':
      return list.sort((a, b) => a.bookmark.openCount - b.bookmark.openCount || a.placement.order - b.placement.order);
    case 'clicks-desc':
      return list.sort((a, b) => b.bookmark.openCount - a.bookmark.openCount || a.placement.order - b.placement.order);
    default:
      return list.sort((a, b) => a.placement.order - b.placement.order);
  }
}

export const effectiveView = (d: Drawer, w: Workspace): ViewMode => d.viewMode ?? w.viewMode;

export interface DrawerData { drawer: Drawer; items: Item[]; mounted: Item[] }
export interface WorkspaceData { workspace: Workspace; top: Item[]; drawers: DrawerData[] }

/** 读取一个工作区的完整视图（含分身书签组展开、场景过滤、排序） */
export async function loadWorkspace(db: NavillDB, workspaceId: string, v: Visibility): Promise<WorkspaceData | null> {
  const workspace = await db.workspaces.get(workspaceId);
  if (!workspace) return null;
  const drawers = (await db.drawers.where('workspaceId').equals(workspaceId).sortBy('order')).filter((d) => drawerVisible(d, v));
  const placements = await db.placements.where('workspaceId').equals(workspaceId).toArray();

  const drawerIds = drawers.map((d) => d.id);
  const groups = drawerIds.length ? await db.aliasGroups.where('targetDrawerId').anyOf(drawerIds).toArray() : [];
  const sourceIds = [...new Set(groups.map((g) => g.sourceDrawerId))];
  const sourceDrawers = new Map((await db.drawers.bulkGet(sourceIds)).filter(Boolean).map((d) => [d!.id, d!]));
  const sourcePlacements = sourceIds.length ? await db.placements.where('drawerId').anyOf(sourceIds).toArray() : [];

  const bookmarkIds = [...new Set([...placements, ...sourcePlacements].map((p) => p.bookmarkId))];
  const bookmarks = new Map((await db.bookmarks.bulkGet(bookmarkIds)).filter(Boolean).map((b) => [b!.id, b!]));

  const toItems = (ps: Placement[]) =>
    ps.flatMap((p) => {
      const b = bookmarks.get(p.bookmarkId);
      return b && bookmarkVisible(b, v) ? [{ placement: p, bookmark: b }] : [];
    });

  const top = sortItems(toItems(placements.filter((p) => p.drawerId === null)));
  const data: DrawerData[] = drawers.map((drawer) => {
    const own = toItems(placements.filter((p) => p.drawerId === drawer.id));
    const ownBookmarks = new Set(own.map((i) => i.bookmark.id));
    const mounted: Item[] = [];
    for (const g of groups.filter((x) => x.targetDrawerId === drawer.id).sort((a, b) => a.order - b.order)) {
      const src = sourceDrawers.get(g.sourceDrawerId);
      if (!src || !drawerVisible(src, v)) continue;
      const items = sortItems(toItems(sourcePlacements.filter((p) => p.drawerId === src.id)), src.sortMode ?? 'smart');
      for (const it of items) {
        if (ownBookmarks.has(it.bookmark.id)) continue;
        ownBookmarks.add(it.bookmark.id);
        mounted.push({ ...it, mountedFrom: { group: g, drawer: src } });
      }
    }
    return { drawer, items: sortItems(own, drawer.sortMode ?? 'smart'), mounted };
  });
  return { workspace, top, drawers: data };
}

/** 每个书签取一个可见位置（原书签优先）：工作区、抽屉都要在当前场景可见 */
async function visiblePlacementPicker(db: NavillDB, v: Visibility): Promise<(bookmarkId: string) => VisiblePlacement | null> {
  const [workspaces, drawers, placements] = await Promise.all([db.workspaces.toArray(), db.drawers.toArray(), db.placements.toArray()]);
  const wsMap = new Map(workspaces.map((w) => [w.id, w]));
  const drMap = new Map(drawers.map((d) => [d.id, d]));
  const byBookmark = new Map<string, Placement[]>();
  for (const p of placements) {
    const list = byBookmark.get(p.bookmarkId);
    if (list) list.push(p); else byBookmark.set(p.bookmarkId, [p]);
  }
  for (const list of byBookmark.values()) list.sort((x, y) => Number(x.isAlias) - Number(y.isAlias));
  return (bookmarkId) => {
    for (const p of byBookmark.get(bookmarkId) ?? []) {
      const workspace = wsMap.get(p.workspaceId);
      const drawer = p.drawerId ? drMap.get(p.drawerId) ?? null : null;
      if (workspace && workspaceVisible(workspace, v) && (!drawer || drawerVisible(drawer, v))) return { placement: p, workspace, drawer };
    }
    return null;
  };
}
interface VisiblePlacement { placement: Placement; workspace: Workspace; drawer: Drawer | null }

export interface SearchHit { item: Item; workspace: Workspace; drawer: Drawer | null }

/** 全局搜索：标题 + URL + 备注；`#标签` 按标签筛选；只搜当前场景可见内容 */
export async function search(db: NavillDB, query: string, v: Visibility, limit = 100): Promise<SearchHit[]> {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const tags: Tag[] = localizeNames(await db.tags.toArray());
  const tagTokens = tokens.filter((t) => t.startsWith('#') && t.length > 1).map((t) => t.slice(1));
  const words = tokens.filter((t) => !t.startsWith('#'));
  const wantTags = tagTokens.map((t) => tags.filter((x) => x.name.toLowerCase().startsWith(t)).map((x) => x.id));
  if (wantTags.some((ids) => ids.length === 0)) return [];

  const [pick, bookmarks] = await Promise.all([visiblePlacementPicker(db, v), db.bookmarks.toArray()]);
  const hits: SearchHit[] = [];
  for (const b of bookmarks) {
    if (!bookmarkVisible(b, v)) continue;
    if (!wantTags.every((ids) => ids.some((id) => b.tagIds.includes(id)))) continue;
    const hay = `${b.title}\n${b.url}\n${b.note ?? ''}\n${(b.links ?? []).map((l) => `${l.title ?? ''} ${l.url}`).join('\n')}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) continue;
    const at = pick(b.id);
    if (at) hits.push({ item: { placement: at.placement, bookmark: b }, workspace: at.workspace, drawer: at.drawer });
  }
  return hits
    .sort((a, b) => b.item.bookmark.openCount - a.item.bookmark.openCount || collator.compare(a.item.bookmark.title, b.item.bookmark.title))
    .slice(0, limit);
}

export interface DrawerHit { drawer: Drawer; workspace: Workspace }

/** 搜索抽屉：名称 + 说明；带 `#标签` 时不搜抽屉；归档的抽屉不在工作区显示，不参与 */
export async function searchDrawers(db: NavillDB, query: string, v: Visibility, limit = 20): Promise<DrawerHit[]> {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.some((t) => t.startsWith('#'))) return [];
  const [workspaces, drawers] = await Promise.all([db.workspaces.toArray(), db.drawers.toArray()]);
  const wsMap = new Map(localizeNames(workspaces).map((w) => [w.id, w]));
  const visible: Visibility = { ...v, includeArchived: false };
  const hits: DrawerHit[] = [];
  for (const drawer of localizeNames(drawers)) {
    const workspace = wsMap.get(drawer.workspaceId);
    if (!workspace || !workspaceVisible(workspace, visible) || !drawerVisible(drawer, visible)) continue;
    const hay = `${drawer.name}\n${drawer.description ?? ''}`.toLowerCase();
    if (tokens.every((t) => hay.includes(t))) hits.push({ drawer, workspace });
  }
  return hits
    .sort((a, b) => Number(!a.drawer.name.toLowerCase().startsWith(tokens[0]!)) - Number(!b.drawer.name.toLowerCase().startsWith(tokens[0]!)) || a.workspace.order - b.workspace.order || a.drawer.order - b.drawer.order)
    .slice(0, limit);
}

/** 带某个标签（按 id）的书签，每个书签取一个可见位置，原书签优先；按打开次数、标题排序 */
export async function taggedItems(db: NavillDB, tagId: string, v: Visibility): Promise<Item[]> {
  const [pick, bookmarks] = await Promise.all([visiblePlacementPicker(db, v), db.bookmarks.where('tagIds').equals(tagId).toArray()]);
  const out: Item[] = [];
  for (const b of bookmarks.filter((b) => bookmarkVisible(b, v)).sort((a, b) => b.openCount - a.openCount || collator.compare(a.title, b.title))) {
    const at = pick(b.id);
    if (at) out.push({ placement: at.placement, bookmark: b });
  }
  return out;
}

/** 打开次数最多的书签（只算打开过的），每个书签取一个可见位置，原书签优先 */
export async function mostOpened(db: NavillDB, v: Visibility, limit = 20): Promise<Item[]> {
  const [pick, bookmarks] = await Promise.all([visiblePlacementPicker(db, v), db.bookmarks.toArray()]);
  const out: Item[] = [];
  for (const b of bookmarks.filter((b) => b.openCount > 0 && bookmarkVisible(b, v)).sort((a, b) => b.openCount - a.openCount)) {
    const at = pick(b.id);
    if (at) out.push({ placement: at.placement, bookmark: b });
    if (out.length >= limit) break;
  }
  return out;
}
