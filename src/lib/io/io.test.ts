// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createDB } from '@/src/db';
import { buildImportPlan } from '../import/plan';
import { createBookmark, createDrawer, createWorkspace, ensureSeed } from '../store';
import { exportBackup, parseBackup, restoreBackup } from './backup';
import { exportNetscapeHtml, parseNetscapeHtml } from './html';

describe('导入导出', () => {
  it('JSON 备份往返', async () => {
    const a = createDB('io-a');
    await ensureSeed(a);
    const ws = await createWorkspace(a, { name: '工作' });
    const d = await createDrawer(a, ws.id, '项目');
    await createBookmark(a, { url: 'https://a.com', title: 'A' }, ws.id, d.id);
    const text = JSON.stringify(await exportBackup(a));

    const b = createDB('io-b');
    await restoreBackup(b, parseBackup(text), 'replace');
    expect((await b.bookmarks.toArray()).map((x) => x.title)).toEqual(['A']);
    expect((await b.drawers.toArray()).map((x) => x.name)).toEqual(['项目']);
    expect(() => parseBackup('{"format":"x"}')).toThrow('不是 Navill 备份文件');
  });

  it('HTML 导出再导入，规则同书签栏', async () => {
    const a = createDB('io-c');
    await ensureSeed(a);
    const ws = await createWorkspace(a, { name: '工作' });
    const d = await createDrawer(a, ws.id, '项目');
    await createBookmark(a, { url: 'https://a.com', title: 'A & B' }, ws.id, d.id);
    await createBookmark(a, { url: 'https://top.com', title: '顶层' }, ws.id, null);
    const html = await exportNetscapeHtml(a);
    const plan = buildImportPlan(parseNetscapeHtml(html));
    const w = plan.workspaces.find((x) => x.name === '工作')!;
    expect(w.topLevel.map((b) => b.title)).toEqual(['顶层']);
    expect(w.drawers.map((x) => [x.name, x.bookmarks[0]!.title])).toEqual([['项目', 'A & B']]);
  });
});
