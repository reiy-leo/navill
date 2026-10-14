import { describe, expect, it } from 'vitest';
import { edgeWorkspaceName, findEdgeWorkspaceNodes, type BookmarkNode } from './edge-workspace';

const node = (id: string, title: string, children?: BookmarkNode[]): BookmarkNode =>
  ({ id, title, children, syncing: false }) as BookmarkNode;

describe('Edge 工作区节点', () => {
  const root = node('0', '', [
    node('1', '书签栏', []),
    node('2', '其他书签', []),
    node('3', '移动设备书签', []),
    node('10', '', [node('11', '工作')]),
    node('20', '', []),
  ]);

  it('只识别与内置根同级的无标题节点', () => {
    expect(findEdgeWorkspaceNodes(root).map((n) => n.id)).toEqual(['10', '20']);
  });

  it('名称取第一个子节点标题，空则回退', () => {
    const [a, b] = findEdgeWorkspaceNodes(root);
    expect(edgeWorkspaceName(a!, 0)).toBe('工作');
    expect(edgeWorkspaceName(b!, 1)).toBe('Edge 工作区 2');
  });
});
