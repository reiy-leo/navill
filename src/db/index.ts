import Dexie, { type EntityTable } from 'dexie';

// 数据模型见 docs/PLAN.md §4。IndexedDB 为本地事实来源，界面不等待网络。
export type ViewMode = 'icon' | 'row' | 'tile' | 'bento';
/** smart：智能（默认），点击多的在前，近期打开过的略靠前 */
export type SortMode = 'smart' | 'manual' | 'name-asc' | 'name-desc' | 'clicks-asc' | 'clicks-desc';
export type WorkspaceSource = 'bookmark_bar' | 'other' | 'mobile' | 'edge_workspace' | 'manual' | 'inbox';

/** 工作区上限（含「待整理」） */
export const MAX_WORKSPACES = 30;

export interface Workspace {
  id: string; name: string;
  /** Emoji 图标（最多 2 个） */ emoji?: string;
  /** Lucide 图标名（kebab-case，如 "briefcase"） */ lucide?: string;
  /** 字符图标：用户输入的 1–2 个字；为空时用名称首字 */ glyph?: string;
  color?: string; description?: string; order: number; viewMode: ViewMode;
  source: WorkspaceSource; sourceNodeId?: string; adult?: boolean; createdAt: number; updatedAt: number;
}
export interface Drawer {
  id: string; workspaceId: string; name: string; path: string[]; order: number; collapsed: boolean;
  viewMode?: ViewMode; sortMode?: SortMode; adult?: boolean; sourceNodeId?: string;
  /** 抽屉颜色；为空时跟随工作区 */ color?: string;
  /** 说明：悬停抽屉名称时显示 */ description?: string;
  /** 归档时间：归档的抽屉在工作区隐藏，集中到「归档」 */ archivedAt?: number; updatedAt: number;
  /** 内容区高度（px），底部拖拽手柄调整；为空时自适应。collapsed 已停用 */ height?: number;
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
  /** 场景颜色与 Lucide 图标名；缺省时按预设或顺序取 */
  color?: string; icon?: string;
}
export interface Tag {
  id: string; name: string; builtin: 'adult' | 'favorite' | 'todo' | null; order: number; createdAt: number; updatedAt: number;
}
export interface Tombstone { id: string; entity: SyncEntity; entityId: string; deletedAt: number }
export interface OutboxItem { id: string; entity: SyncEntity; entityId: string; op: 'put' | 'delete'; updatedAt: number }
export interface Meta { key: string; value: unknown }
/** 高清网站图标缓存（按域名，只存本地，不同步） */
export interface IconCache { host: string; blob?: Blob; source?: 'page' | 'icon.horse' | 'google'; fetchedAt: number; failed?: boolean }

/** 日志：本机始终记录；设置里开启「日志」后按设备、按月追加上传 */
export type LogKind = 'create' | 'rename' | 'edit' | 'delete' | 'move' | 'archive' | 'restore' | 'alias' | 'install' | 'signin';
export type LogTarget = 'workspace' | 'drawer' | 'bookmark' | 'device' | 'sync';
export interface LogEntry {
  id: string; at: number; deviceId: string; /** 浏览器 · 系统，如「Edge · Windows」 */ device?: string;
  kind: LogKind; targetType: LogTarget; targetId?: string; summary: string;
}

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
  icons: EntityTable<IconCache, 'host'>;
  logs: EntityTable<LogEntry, 'id'>;
};

/** 自动分配用的 10 种颜色，取自预置色（src/ui/colors.ts）：丹柿 榴火 荷花 葡萄 琉璃 碧空 春水 柳色 芒种 烟灰 */
export const PALETTE = ['#dc631e', '#da4339', '#ca5e96', '#8b5fb9', '#5d76d0', '#248fcc', '#1d9999', '#58994a', '#bb8d0c', '#747b83'];

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
  d.version(3).stores({ icons: 'host, fetchedAt' });
  d.version(4).stores({ logs: 'id, at, deviceId' });
  return d;
}

export const db = createDB();

export const INBOX_NAME = '待整理';
/** 「待整理」固定 ID：多设备各自创建时同步后合并为同一个 */
export const INBOX_ID = 'ws-inbox';
/** 「待整理」固定排在末尾 */
export const INBOX_ORDER = Number.MAX_SAFE_INTEGER;

export const TAG_ADULT = 'tag-adult';
export const TAG_FAVORITE = 'tag-favorite';
export const TAG_TODO = 'tag-todo';
export const MODE_DEFAULT = 'mode-default';
