import { MODE_DEFAULT, TAG_ADULT, type AliasGroup, type Bookmark, type Drawer, type Mode, type NavillDB, type Placement, type SortMode, type Tag, type ViewMode, type Workspace } from '@/src/db';

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
export const drawerVisible = (d: Drawer, v: Visibility) => !v.hiddenDrawers.has(d.id) && (v.showAdult || !d.adult);
export const bookmarkVisible = (b: Bookmark, v: Visibility) =>
  (v.includeArchived || !b.archivedAt) && (v.showAdult || !b.tagIds.includes(TAG_ADULT));

const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });

export function sortItems(items: Item[], mode: SortMode = 'manual'): Item[] {
  const list = [...items];
  switch (mode) {
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
      const items = sortItems(toItems(sourcePlacements.filter((p) => p.drawerId === src.id)), src.sortMode);
      for (const it of items) {
        if (ownBookmarks.has(it.bookmark.id)) continue;
        ownBookmarks.add(it.bookmark.id);
        mounted.push({ ...it, mountedFrom: { group: g, drawer: src } });
      }
    }
    return { drawer, items: sortItems(own, drawer.sortMode), mounted };
  });
  return { workspace, top, drawers: data };
}

export interface SearchHit { item: Item; workspace: Workspace; drawer: Drawer | null }

/** 全局搜索：标题 + URL + 备注；`#标签` 按标签筛选；只搜当前场景可见内容 */
export async function search(db: NavillDB, query: string, v: Visibility, limit = 100): Promise<SearchHit[]> {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const tags: Tag[] = await db.tags.toArray();
  const tagTokens = tokens.filter((t) => t.startsWith('#') && t.length > 1).map((t) => t.slice(1));
  const words = tokens.filter((t) => !t.startsWith('#'));
  const wantTags = tagTokens.map((t) => tags.filter((x) => x.name.toLowerCase().startsWith(t)).map((x) => x.id));
  if (wantTags.some((ids) => ids.length === 0)) return [];

  const [workspaces, drawers, placements, bookmarks] = await Promise.all([
    db.workspaces.toArray(), db.drawers.toArray(), db.placements.toArray(), db.bookmarks.toArray(),
  ]);
  const wsMap = new Map(workspaces.map((w) => [w.id, w]));
  const drMap = new Map(drawers.map((d) => [d.id, d]));
  const byBookmark = new Map<string, Placement[]>();
  for (const p of placements) byBookmark.set(p.bookmarkId, [...(byBookmark.get(p.bookmarkId) ?? []), p]);

  const hits: SearchHit[] = [];
  for (const b of bookmarks) {
    if (!bookmarkVisible(b, v)) continue;
    if (!wantTags.every((ids) => ids.some((id) => b.tagIds.includes(id)))) continue;
    const hay = `${b.title}\n${b.url}\n${b.note ?? ''}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) continue;
    // 取一个可见的位置，原书签优先
    const ps = (byBookmark.get(b.id) ?? []).sort((x, y) => Number(x.isAlias) - Number(y.isAlias));
    for (const p of ps) {
      const w = wsMap.get(p.workspaceId);
      const d = p.drawerId ? drMap.get(p.drawerId) ?? null : null;
      if (!w || !workspaceVisible(w, v) || (d && !drawerVisible(d, v))) continue;
      hits.push({ item: { placement: p, bookmark: b }, workspace: w, drawer: d });
      break;
    }
  }
  return hits
    .sort((a, b) => b.item.bookmark.openCount - a.item.bookmark.openCount || collator.compare(a.item.bookmark.title, b.item.bookmark.title))
    .slice(0, limit);
}
