import { MAX_WORKSPACES, MODE_DEFAULT, PALETTE, type Drawer, type NavillDB, type ViewMode, type Workspace } from '@/src/db';
import { del, patch, put, tx, uid } from './core';
import { deleteDrawer } from './drawer';
import { removePlacement } from './placement';
import { hideEverywhereExcept } from './mode';
import { splitEmoji } from '../emoji';

export class WorkspaceLimitError extends Error {
  constructor() { super(`最多只能有 ${MAX_WORKSPACES} 个工作区`); }
}

export async function createWorkspace(
  db: NavillDB, input: Partial<Pick<Workspace, 'name' | 'emoji' | 'lucide' | 'color' | 'description'>> = {}, onlyInMode?: string,
) {
  return tx(db, async () => {
    const all = await db.workspaces.toArray();
    if (all.length >= MAX_WORKSPACES) throw new WorkspaceLimitError();
    const regular = all.filter((w) => w.source !== 'inbox');
    const ws = await put<Workspace>(db, 'workspaces', {
      id: uid(),
      ...normalizeName(input.name, input.emoji, '新工作区'),
      lucide: input.lucide,
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
  db: NavillDB, id: string, changes: Partial<Pick<Workspace, 'name' | 'emoji' | 'lucide' | 'color' | 'description' | 'viewMode' | 'adult'>>,
) {
  const ws = await db.workspaces.get(id);
  if (!ws) return;
  if (ws.source === 'inbox') delete changes.name; // 「待整理」不可改名
  if (changes.name !== undefined) {
    const parsed = splitEmoji(changes.name);
    changes.name = parsed.name || ws.name;
    // 名称里写了 emoji 就以它为准作为图标（最多两个）
    if (parsed.emoji) changes.emoji = parsed.emoji;
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

/** 工作区名称不能含 emoji：名称里的 emoji（最多两个）作为图标，优先于传入的图标 */
function normalizeName(raw: string | undefined, emoji: string | undefined, fallback: string) {
  const parsed = splitEmoji(raw ?? '');
  return { name: parsed.name || fallback, emoji: parsed.emoji || emoji };
}

/** 从工作区名称中解析图标：名称里的 emoji 全部去掉，前两个 emoji 作为图标（覆盖原图标）。每次启动时自动运行。返回处理的工作区数 */
export async function parseWorkspaceIcons(db: NavillDB): Promise<number> {
  return tx(db, async () => {
    let n = 0;
    for (const ws of await db.workspaces.toArray()) {
      const parsed = splitEmoji(ws.name);
      if (parsed.name === ws.name) continue;
      const changes: Partial<Workspace> = { name: parsed.name || ws.name };
      if (parsed.emoji) changes.emoji = parsed.emoji;
      await patch<Workspace>(db, 'workspaces', ws.id, changes);
      n++;
    }
    return n;
  });
}
