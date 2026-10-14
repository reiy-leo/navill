import type { Browser } from 'wxt/browser';

/**
 * Edge 工作区节点：chrome.bookmarks.getTree() 根节点下，与 bookmark_bar / other / mobile
 * 同级的无标题节点。注意与 Navill 自身的 Workspace 严格区分命名。
 */

export type BookmarkNode = Browser.bookmarks.BookmarkTreeNode;

const BUILTIN_ROOT_IDS = new Set(['1', '2', '3']); // bookmark_bar / other / mobile

export function findEdgeWorkspaceNodes(root: BookmarkNode): BookmarkNode[] {
  return (root.children ?? []).filter(
    (n: BookmarkNode) => !BUILTIN_ROOT_IDS.has(n.id) && !(n as { folderType?: string }).folderType && !n.title,
  );
}

/** 名称取第一个子节点标题；为空回退为「Edge 工作区 N」（N 从 1 开始） */
export function edgeWorkspaceName(node: BookmarkNode, index: number): string {
  const first = node.children?.[0]?.title?.trim();
  return first ? first : `Edge 工作区 ${index + 1}`;
}
