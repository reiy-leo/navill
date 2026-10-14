import { describe, expect, it } from 'vitest';
import { classifyRoot, edgeWorkspaceName, findEdgeWorkspaceNodes } from './edge-workspace';
import { folder, root } from './test-tree';

describe('Edge 工作区节点', () => {
  const tree = root([
    folder('1', '书签栏', []),
    folder('2', '其他书签', []),
    folder('3', '移动设备书签', []),
    folder('10', '', [folder('11', '工作', [])]),
    folder('20', '', []),
  ]);

  it('只识别与内置根同级的无标题节点', () => {
    expect(findEdgeWorkspaceNodes(tree).map((n) => n.id)).toEqual(['10', '20']);
  });

  it('名称取第一个子节点标题，空则回退', () => {
    const [a, b] = findEdgeWorkspaceNodes(tree);
    expect(edgeWorkspaceName(a!, 0)).toBe('工作');
    expect(edgeWorkspaceName(b!, 1)).toBe('Edge 工作区 2');
  });

  it('优先按 folderType 识别内置根', () => {
    expect(classifyRoot({ ...folder('99', 'Bookmarks bar', []), folderType: 'bookmarks-bar' } as never)).toBe('bookmark_bar');
    expect(classifyRoot({ ...folder('98', '', []), folderType: 'managed' } as never)).toBe('managed');
  });
});
