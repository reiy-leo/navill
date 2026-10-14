import Dexie, { type EntityTable } from 'dexie';

// 数据模型见 docs/PLAN.md §4。IndexedDB 为本地事实来源，界面不等待网络。
export type ViewMode = 'icon' | 'row' | 'tile' | 'bento';
export type SortMode = 'manual' | 'name-asc' | 'name-desc' | 'clicks-asc' | 'clicks-desc';
export type WorkspaceSource = 'bookmark_bar' | 'other' | 'mobile' | 'edge_workspace' | 'manual' | 'inbox';

export interface Workspace {
  id: string; name: string; emoji?: string; color?: string; description?: string; order: number; viewMode: ViewMode;
  source: WorkspaceSource; sourceNodeId?: string; adult?: boolean; createdAt: number; updatedAt: number;
}
export interface Drawer {
  id: string; workspaceId: string; name: string; path: string[]; order: number; collapsed: boolean;
  viewMode?: ViewMode; sortMode?: SortMode; adult?: boolean; sourceNodeId?: string; updatedAt: number;
}
/** 关联链接：同一个书签的其他方面（GitHub、文档、社交账号…） */
export interface BookmarkLink { url: string; title?: string }
export interface Bookmark {
  id: string; url: string; title: string; faviconUrl?: string; note?: string; archivedAt?: number;
  /** 关联链接，按数组顺序显示 */
  links?: BookmarkLink[];
  tagIds: string[]; openCount: number; lastOpenedAt?: number; createdAt: number; updatedAt: number;
}
export interface Placement {
  id: string; bookmarkId: string; workspaceId: string; drawerId: string | null; order: number; isAlias: boolean;
  updatedAt: number;
}
export interface OpenEvent { id: string; bookmarkId: string; placementId: string; openedAt: number; deviceId: string }
export interface AliasGroup {
  id: string; sourceDrawerId: string; targetDrawerId: string; order: number; createdAt: number; updatedAt: number;
}
export interface Mode {
  id: string; name: string; builtin: 'default' | null; order: number;
  hiddenWorkspaceIds: string[]; hiddenDrawerIds: string[]; showAdult: boolean; createdAt: number; updatedAt: number;
}
export interface Tag {
  id: string; name: string; builtin: 'adult' | 'favorite' | 'todo' | null; order: number; createdAt: number; updatedAt: number;
}
export interface Tombstone { id: string; entity: SyncEntity; entityId: string; deletedAt: number }
export interface OutboxItem { id: string; entity: SyncEntity; entityId: string; op: 'put' | 'delete'; updatedAt: number }
export interface Meta { key: string; value: unknown }

export type SyncEntity = 'workspaces' | 'drawers' | 'bookmarks' | 'placements' | 'aliasGroups' | 'modes' | 'tags';
export const SYNC_ENTITIES: SyncEntity[] = ['workspaces', 'drawers', 'bookmarks', 'placements', 'aliasGroups', 'modes', 'tags'];

export type NavillDB = Dexie & {
  workspaces: EntityTable<Workspace, 'id'>;
  drawers: EntityTable<Drawer, 'id'>;
  bookmarks: EntityTable<Bookmark, 'id'>;
  placements: EntityTable<Placement, 'id'>;
  openEvents: EntityTable<OpenEvent, 'id'>;
  aliasGroups: EntityTable<AliasGroup, 'id'>;
  modes: EntityTable<Mode, 'id'>;
  tags: EntityTable<Tag, 'id'>;
  tombstones: EntityTable<Tombstone, 'id'>;
  outbox: EntityTable<OutboxItem, 'id'>;
  meta: EntityTable<Meta, 'key'>;
};

export const PALETTE = ['#f6821f', '#e5484d', '#d6409f', '#8e4ec6', '#3e63dd', '#0090ff', '#12a594', '#30a46c', '#ffb224', '#8d8d86'];

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
  d.version(2)
    .stores({
      openEvents: 'id, bookmarkId, openedAt, deviceId',
      outbox: 'id, entity, updatedAt',
      modes: 'id, order',
      tags: 'id, order',
      tombstones: 'id, entity, deletedAt',
    })
    .upgrade(async (tx) => {
      const now = Date.now();
      let i = 0;
      await tx.table('workspaces').toCollection().modify((w: Workspace) => {
        w.updatedAt ??= now;
        if (!w.color) w.color = PALETTE[i++ % PALETTE.length];
      });
      for (const t of ['drawers', 'placements', 'aliasGroups']) {
        await tx.table(t).toCollection().modify((r: { updatedAt?: number }) => {
          r.updatedAt ??= now;
        });
      }
      await tx.table('bookmarks').toCollection().modify((b: Bookmark) => {
        b.tagIds ??= [];
      });
    });
  return d;
}

export const db = createDB();

export const INBOX_NAME = '待整理';
/** 「待整理」固定排在末尾 */
export const INBOX_ORDER = Number.MAX_SAFE_INTEGER;

export const TAG_ADULT = 'tag-adult';
export const TAG_FAVORITE = 'tag-favorite';
export const TAG_TODO = 'tag-todo';
export const MODE_DEFAULT = 'mode-default';
