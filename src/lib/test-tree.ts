import type { BookmarkNode } from './edge-workspace';

/** 单测用：快速构造书签树 */
export const bm = (id: string, title: string, url = `https://example.com/${id}`): BookmarkNode =>
  ({ id, title, url, syncing: false }) as BookmarkNode;
export const folder = (id: string, title: string, children: BookmarkNode[]): BookmarkNode =>
  ({ id, title, children, syncing: false }) as BookmarkNode;
export const root = (children: BookmarkNode[]): BookmarkNode => folder('0', '', children);
