import { MODE_DEFAULT, PALETTE, type Drawer, type NavillDB, type ViewMode, type Workspace } from '@/src/db';
import { del, patch, put, tx, uid } from './core';
import { deleteDrawer } from './drawer';
import { removePlacement } from './placement';
import { hideEverywhereExcept } from './mode';
import { splitEmoji } from '../emoji';

export async function createWorkspace(
  db: NavillDB, input: Partial<Pick<Workspace, 'name' | 'emoji' | 'color' | 'description'>> = {}, onlyInMode?: string,
) {
  return tx(db, async () => {
    const all = await db.workspaces.toArray();
    const regular = all.filter((w) => w.source !== 'inbox');
    const ws = await put<Workspace>(db, 'workspaces', {
      id: uid(),
      ...normalizeName(input.name, input.emoji, '新工作区'),
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
  if (changes.name !== undefined) {
    const n = normalizeName(changes.name, changes.emoji ?? ws.emoji, ws.name);
    changes.name = n.name;
    if (!(changes.emoji ?? ws.emoji) && n.emoji) changes.emoji = n.emoji;
  }
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

/** 工作区名称不能含 emoji：拆出的第一个 emoji 在没有图标时作为图标 */
function normalizeName(raw: string | undefined, emoji: string | undefined, fallback: string) {
  const parsed = splitEmoji(raw ?? '');
  return { name: parsed.name || fallback, emoji: emoji || parsed.emoji };
}

/** 从现有工作区名称中解析图标：名称里的 emoji 全部去掉，没有图标的用第一个 emoji 当图标。返回处理的工作区数 */
export async function parseWorkspaceIcons(db: NavillDB): Promise<number> {
  return tx(db, async () => {
    let n = 0;
    for (const ws of await db.workspaces.toArray()) {
      const parsed = splitEmoji(ws.name);
      if (parsed.name === ws.name) continue;
      const changes: Partial<Workspace> = { name: parsed.name || ws.name };
      if (!ws.emoji && parsed.emoji) changes.emoji = parsed.emoji;
      await patch<Workspace>(db, 'workspaces', ws.id, changes);
      n++;
    }
    return n;
  });
}
