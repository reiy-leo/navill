import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createDB } from '@/src/db';
import { archiveDrawer, createDrawer, createWorkspace } from './store';
import { searchDrawers, visibilityOf } from './view';

describe('搜索抽屉', () => {
  it('按名称和说明匹配，跳过归档与 #标签', async () => {
    const db = createDB('drawer-search');
    const ws = await createWorkspace(db, { name: '工作' });
    await createDrawer(db, ws.id, '前端工具');
    await createDrawer(db, ws.id, '设计', undefined, undefined, '配色和前端灵感');
    const old = await createDrawer(db, ws.id, '前端旧');
    await archiveDrawer(db, old.id);
    await createDrawer(db, ws.id, '后端');
    const v = visibilityOf(undefined);
    const hits = await searchDrawers(db, '前端', v);
    expect(hits.map((h) => h.drawer.name)).toEqual(['前端工具', '设计']);
    expect(hits[0]!.workspace.id).toBe(ws.id);
    expect(await searchDrawers(db, '#前端', v)).toEqual([]);
    expect(await searchDrawers(db, '  ', v)).toEqual([]);
  });
});
