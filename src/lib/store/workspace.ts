import { MODE_DEFAULT, PALETTE, type Drawer, type NavillDB, type ViewMode, type Workspace } from '@/src/db';
import { del, patch, put, tx, uid } from './core';
import { deleteDrawer } from './drawer';
import { removePlacement } from './placement';
import { hideEverywhereExcept } from './mode';

export async function createWorkspace(
  db: NavillDB, input: Partial<Pick<Workspace, 'name' | 'emoji' | 'color' | 'description'>> = {}, onlyInMode?: string,
) {
  return tx(db, async () => {
    const all = await db.workspaces.toArray();
    const regular = all.filter((w) => w.source !== 'inbox');
    const ws = await put<Workspace>(db, 'workspaces', {
      id: uid(),
      name: input.name?.trim() || '新工作区',
      emoji: input.emoji,
      color: input.color ?? PALETTE[regular.length % PALETTE.length],
      description: input.description,
      order: regular.reduce((m, w) => Math.max(m, w.order), -1) + 1,
      viewMode: 'tile',
      source: 'manual',
      createdAt: Date.now(),
      updatedAt: 0,
    });
    if (onlyInMode && onlyInMode !== MODE_DEFAULT) await hideEverywhereExcept(db, 'workspace', ws.id, onlyInMode);
    return ws;
  });
}

export async function updateWorkspace(
  db: NavillDB, id: string, changes: Partial<Pick<Workspace, 'name' | 'emoji' | 'color' | 'description' | 'viewMode' | 'adult'>>,
) {
  const ws = await db.workspaces.get(id);
  if (!ws) return;
  if (ws.source === 'inbox') delete changes.name; // 「待整理」不可改名
  if (changes.description) changes.description = changes.description.slice(0, 50);
  await patch<Workspace>(db, 'workspaces', id, changes);
}

export async function setWorkspaceView(db: NavillDB, id: string, viewMode: ViewMode) {
  await patch<Workspace>(db, 'workspaces', id, { viewMode });
}

export async function reorderWorkspaces(db: NavillDB, ids: string[]) {
  await tx(db, async () => {
    let i = 0;
    for (const id of ids) {
      const ws = await db.workspaces.get(id);
      if (!ws || ws.source === 'inbox') continue;
      await patch<Workspace>(db, 'workspaces', id, { order: i++ });
    }
  });
}

/** 删除工作区及其中全部抽屉与书签位置；「待整理」不可删除 */
export async function deleteWorkspace(db: NavillDB, id: string) {
  await tx(db, async () => {
    const ws = await db.workspaces.get(id);
    if (!ws || ws.source === 'inbox') return;
    const drawers: Drawer[] = await db.drawers.where('workspaceId').equals(id).toArray();
    for (const d of drawers) await deleteDrawer(db, d.id);
    const rest = await db.placements.where('workspaceId').equals(id).toArray();
    for (const p of rest) await removePlacement(db, p.id);
    await del(db, 'workspaces', id);
  });
}
