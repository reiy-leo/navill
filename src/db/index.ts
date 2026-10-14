import Dexie, { type EntityTable } from 'dexie';

// 数据模型见 docs/PLAN.md §4。IndexedDB 为本地事实来源，界面不等待网络。
export type ViewMode = 'icon' | 'row' | 'tile' | 'bento';
export type SortMode = 'manual' | 'name-asc' | 'name-desc' | 'clicks-asc' | 'clicks-desc';
export type WorkspaceSource = 'bookmark_bar' | 'other' | 'mobile' | 'edge_workspace' | 'manual' | 'inbox';

export interface Workspace {
  id: string; name: string; icon?: string; order: number; viewMode: ViewMode;
  source: WorkspaceSource; sourceNodeId?: string; adult?: boolean; createdAt: number;
}
export interface Drawer {
  id: string; workspaceId: string; name: string; path: string[]; order: number; collapsed: boolean;
  viewMode?: ViewMode; sortMode?: SortMode; adult?: boolean; sourceNodeId?: string;
}
export interface Bookmark {
  id: string; url: string; title: string; faviconUrl?: string; note?: string; archivedAt?: number;
  tagIds: string[]; openCount: number; lastOpenedAt?: number; createdAt: number; updatedAt: number;
}
export interface Placement {
  id: string; bookmarkId: string; workspaceId: string; drawerId: string | null; order: number; isAlias: boolean;
}
export interface OpenEvent { id: string; bookmarkId: string; placementId: string; openedAt: number }
export interface AliasGroup { id: string; sourceDrawerId: string; targetDrawerId: string; order: number; createdAt: number }
export interface OutboxItem { id: string; entity: string; entityId: string; op: 'put' | 'delete'; updatedAt: number }
export interface Meta { key: string; value: unknown }

export type NavillDB = Dexie & {
  workspaces: EntityTable<Workspace, 'id'>;
  drawers: EntityTable<Drawer, 'id'>;
  bookmarks: EntityTable<Bookmark, 'id'>;
  placements: EntityTable<Placement, 'id'>;
  openEvents: EntityTable<OpenEvent, 'id'>;
  aliasGroups: EntityTable<AliasGroup, 'id'>;
  outbox: EntityTable<OutboxItem, 'id'>;
  meta: EntityTable<Meta, 'key'>;
};

export function createDB(name = 'navill'): NavillDB {
  const d = new Dexie(name) as NavillDB;
  d.version(1).stores({
    workspaces: 'id, order, source',
    drawers: 'id, workspaceId, order',
    bookmarks: 'id, url, archivedAt, *tagIds',
    placements: 'id, bookmarkId, workspaceId, drawerId, [workspaceId+drawerId]',
    openEvents: 'id, bookmarkId, openedAt',
    aliasGroups: 'id, sourceDrawerId, targetDrawerId',
    outbox: 'id, [entity+entityId], updatedAt',
    meta: 'key',
  });
  return d;
}

export const db = createDB();

export const INBOX_NAME = '待整理';
/** 「待整理」固定排在末尾 */
export const INBOX_ORDER = Number.MAX_SAFE_INTEGER;
