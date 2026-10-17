import { splitEmoji } from '../emoji';
import { classifyRoot, edgeWorkspaceName, type BookmarkNode } from '../edge-workspace';

import { tr } from '@/src/i18n';
/**
 * 首次导入：把浏览器书签树转成导入计划（纯函数，便于单测）。规则见 docs/PLAN.md §3：
 * - 每个 Edge 工作区节点 → 一个工作区，名称取第一个子节点标题，空则「Edge 工作区 N」
 * - 书签栏（及勾选导入的其他书签 / 移动设备书签）下每个顶级文件夹 → 一个工作区
 * - 工作区下直接放的书签 → 工作区顶层；各级子文件夹全部拍平为抽屉，抽屉名带路径前缀
 * - 书签栏等根目录的散放书签 → 「待整理」，按来源分抽屉
 * - 空文件夹跳过；没有任何书签的工作区跳过
 */

export type PlanSource = 'bookmark_bar' | 'other' | 'mobile' | 'edge_workspace';

export interface PlannedBookmark {
  title: string;
  url: string;
  sourceNodeId: string;
  dateAdded?: number;
}

export interface PlannedDrawer {
  key: string;
  name: string;
  path: string[];
  bookmarks: PlannedBookmark[];
}

export interface PlannedWorkspace {
  key: string;
  /** 已去掉 emoji 的名称 */
  name: string;
  /** 从原名称解析出的图标 */
  emoji?: string;
  source: PlanSource;
  sourceNodeId: string;
  topLevel: PlannedBookmark[];
  drawers: PlannedDrawer[];
  include: boolean;
}

export interface ImportPlan {
  workspaces: PlannedWorkspace[];
  /** 「待整理」内按来源的抽屉 */
  inbox: PlannedDrawer[];
  /** 默认不导入的根（其他书签 / 移动设备书签）中的书签数，供预览页提示 */
  available: { other: number; mobile: number };
}

export interface PlanOptions {
  includeOther?: boolean;
  includeMobile?: boolean;
}

const ROOT_LABEL: Record<'bookmark_bar' | 'other' | 'mobile', string> = {
  bookmark_bar: tr('书签栏'),
  other: tr('其他书签'),
  mobile: tr('移动设备书签'),
};

export const PATH_SEPARATOR = ' / ';
const UNTITLED_FOLDER = tr('未命名文件夹');

const isFolder = (n: BookmarkNode) => !n.url;

function toBookmark(n: BookmarkNode): PlannedBookmark {
  return { title: n.title || n.url!, url: n.url!, sourceNodeId: n.id, dateAdded: n.dateAdded };
}

export function countBookmarks(n: BookmarkNode): number {
  if (!isFolder(n)) return 1;
  return (n.children ?? []).reduce((sum, c) => sum + countBookmarks(c), 0);
}

/** 把 folder 下的所有子文件夹拍平成抽屉（folder 自身不算） */
function flattenDrawers(folder: BookmarkNode, prefix: string[] = []): PlannedDrawer[] {
  const out: PlannedDrawer[] = [];
  for (const child of folder.children ?? []) {
    if (!isFolder(child)) continue;
    const path = [...prefix, child.title.trim() || UNTITLED_FOLDER];
    const bookmarks = (child.children ?? []).filter((c) => !isFolder(c)).map(toBookmark);
    if (bookmarks.length > 0) {
      out.push({ key: `drawer:${child.id}`, name: path.join(PATH_SEPARATOR), path, bookmarks });
    }
    out.push(...flattenDrawers(child, path));
  }
  return out;
}

function workspaceFrom(node: BookmarkNode, name: string, source: PlanSource): PlannedWorkspace | null {
  const topLevel = (node.children ?? []).filter((c) => !isFolder(c)).map(toBookmark);
  const drawers = flattenDrawers(node);
  if (topLevel.length === 0 && drawers.length === 0) return null;
  const parsed = splitEmoji(name);
  return { key: `ws:${node.id}`, name: parsed.name, emoji: parsed.emoji, source, sourceNodeId: node.id, topLevel, drawers, include: true };
}

export function buildImportPlan(root: BookmarkNode, opts: PlanOptions = {}): ImportPlan {
  const plan: ImportPlan = { workspaces: [], inbox: [], available: { other: 0, mobile: 0 } };
  let edgeIndex = 0;

  for (const node of root.children ?? []) {
    const kind = classifyRoot(node);
    if (kind === 'managed') continue;

    if (kind === 'edge_workspace') {
      const ws = workspaceFrom(node, edgeWorkspaceName(node, edgeIndex), 'edge_workspace');
      edgeIndex++;
      if (ws) plan.workspaces.push(ws);
      continue;
    }

    // 书签栏 / 其他书签 / 移动设备书签 / 未知的有标题根：同一套规则
    const source: 'bookmark_bar' | 'other' | 'mobile' = kind === 'unknown' ? 'other' : kind;
    if (kind === 'other' && !opts.includeOther) {
      plan.available.other += countBookmarks(node);
      continue;
    }
    if (kind === 'mobile' && !opts.includeMobile) {
      plan.available.mobile += countBookmarks(node);
      continue;
    }

    const loose = (node.children ?? []).filter((c) => !isFolder(c)).map(toBookmark);
    if (loose.length > 0) {
      const label = kind === 'unknown' ? node.title : ROOT_LABEL[source];
      plan.inbox.push({ key: `inbox:${node.id}`, name: label, path: [label], bookmarks: loose });
    }
    for (const folder of node.children ?? []) {
      if (!isFolder(folder)) continue;
      const ws = workspaceFrom(folder, folder.title.trim() || UNTITLED_FOLDER, source);
      if (ws) plan.workspaces.push(ws);
    }
  }
  return plan;
}

export function planStats(plan: ImportPlan) {
  const included = plan.workspaces.filter((w) => w.include);
  const drawers = included.reduce((s, w) => s + w.drawers.length, 0);
  const bookmarks =
    included.reduce((s, w) => s + w.topLevel.length + w.drawers.reduce((d, x) => d + x.bookmarks.length, 0), 0) +
    plan.inbox.reduce((s, d) => s + d.bookmarks.length, 0);
  return { workspaces: included.length, drawers, bookmarks };
}
