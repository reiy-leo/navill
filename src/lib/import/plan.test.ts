import { describe, expect, it } from 'vitest';
import { bm, folder, root } from '../test-tree';
import { buildImportPlan, planStats } from './plan';

const tree = root([
  folder('1', '书签栏', [
    bm('b1', '散放 1'),
    folder('f1', '前端', [
      bm('b2', '前端直接'),
      folder('f2', 'React', [bm('b3', 'React 文档'), folder('f3', 'Hooks', [bm('b4', 'useEffect')])]),
      folder('f4', '只有子文件夹', [folder('f5', '深层', [bm('b5', '深层书签')])]),
      folder('f6', '空', []),
    ]),
    folder('f7', '全空工作区', [folder('f8', '空', [])]),
  ]),
  folder('2', '其他书签', [bm('o1', '其他散放'), folder('f9', '读书', [bm('o2', '书')])]),
  folder('3', '移动设备书签', [bm('m1', '手机')]),
  folder('e1', '', [bm('e1a', '我的工作区'), folder('e1f', '资料', [bm('e1b', '资料 1')])]),
  folder('e2', '', [folder('e2f', '', [bm('e2a', '无名')])]),
  { ...folder('4', '托管', [bm('x', 'managed')]), folderType: 'managed' } as never,
]);

describe('buildImportPlan', () => {
  const plan = buildImportPlan(tree);
  const byName = (n: string) => plan.workspaces.find((w) => w.name === n)!;

  it('书签栏顶级文件夹 → 工作区，直接书签留在顶层', () => {
    const ws = byName('前端');
    expect(ws.source).toBe('bookmark_bar');
    expect(ws.topLevel.map((b) => b.title)).toEqual(['前端直接']);
  });

  it('子文件夹全部拍平为抽屉，名称带路径前缀，空文件夹和无直接书签的文件夹跳过', () => {
    expect(byName('前端').drawers.map((d) => d.name)).toEqual([
      'React',
      'React / Hooks',
      '只有子文件夹 / 深层',
    ]);
  });

  it('没有任何书签的工作区跳过', () => {
    expect(plan.workspaces.find((w) => w.name === '全空工作区')).toBeUndefined();
  });

  it('书签栏根目录散放书签 → 待整理「书签栏」抽屉', () => {
    expect(plan.inbox).toHaveLength(1);
    expect(plan.inbox[0]!.name).toBe('书签栏');
    expect(plan.inbox[0]!.bookmarks.map((b) => b.title)).toEqual(['散放 1']);
  });

  it('其他书签 / 移动设备书签默认不导入，只计数', () => {
    expect(plan.available).toEqual({ other: 2, mobile: 1 });
    expect(plan.workspaces.find((w) => w.name === '读书')).toBeUndefined();
  });

  it('Edge 工作区节点 → 工作区，取第一个子节点标题命名，第一个子节点照常导入', () => {
    const ws = byName('我的工作区');
    expect(ws.source).toBe('edge_workspace');
    expect(ws.topLevel.map((b) => b.title)).toEqual(['我的工作区']);
    expect(ws.drawers.map((d) => d.name)).toEqual(['资料']);
  });

  it('Edge 工作区第一个子节点无标题时回退为「Edge 工作区 N」', () => {
    const ws = byName('Edge 工作区 2');
    expect(ws.drawers.map((d) => d.name)).toEqual(['未命名文件夹']);
  });

  it('托管书签不导入', () => {
    expect(JSON.stringify(plan)).not.toContain('managed');
  });

  it('勾选后其他书签按书签栏规则导入', () => {
    const p = buildImportPlan(tree, { includeOther: true, includeMobile: true });
    expect(p.inbox.map((d) => d.name)).toEqual(['书签栏', '其他书签', '移动设备书签']);
    expect(p.workspaces.find((w) => w.name === '读书')?.source).toBe('other');
    expect(p.available).toEqual({ other: 0, mobile: 0 });
  });

  it('统计只算勾选的工作区', () => {
    const p = buildImportPlan(tree);
    const before = planStats(p);
    p.workspaces.find((w) => w.name === '前端')!.include = false;
    const after = planStats(p);
    expect(before.workspaces - after.workspaces).toBe(1);
    expect(before.bookmarks - after.bookmarks).toBe(4);
  });
});
