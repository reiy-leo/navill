import type { Browser } from 'wxt/browser';

/**
 * 浏览器书签树根节点的分类。
 * Edge 工作区节点：chrome.bookmarks.getTree() 根节点下，与 bookmark_bar / other / mobile
 * 同级的无标题节点。代码中一律叫 edgeWorkspaceNode，与 Navill 自身的 Workspace 严格区分。
 */
export type BookmarkNode = Browser.bookmarks.BookmarkTreeNode;
export type RootKind = 'bookmark_bar' | 'other' | 'mobile' | 'managed' | 'edge_workspace' | 'unknown';

type WithFolderType = BookmarkNode & { folderType?: string };

export function classifyRoot(node: BookmarkNode): RootKind {
  const ft = (node as WithFolderType).folderType;
  if (ft === 'bookmarks-bar') return 'bookmark_bar';
  if (ft === 'other') return 'other';
  if (ft === 'mobile') return 'mobile';
  if (ft === 'managed') return 'managed';
  if (!ft) {
    if (node.id === '1') return 'bookmark_bar';
    if (node.id === '2') return 'other';
    if (node.id === '3') return 'mobile';
  }
  return node.title ? 'unknown' : 'edge_workspace';
}

export function findEdgeWorkspaceNodes(root: BookmarkNode): BookmarkNode[] {
  return (root.children ?? []).filter((n: BookmarkNode) => classifyRoot(n) === 'edge_workspace');
}

/** 名称取第一个子节点标题；为空回退为「Edge 工作区 N」（N 从 1 开始） */
export function edgeWorkspaceName(node: BookmarkNode, index: number): string {
  const first = node.children?.[0]?.title?.trim();
  return first ? first : `Edge 工作区 ${index + 1}`;
}
