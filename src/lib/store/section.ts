import type { Drawer, NavillDB, Section, Workspace } from '@/src/db';
import { patch, tx, uid } from './core';
import { logged, q } from '../log';

import { tr } from '@/src/i18n';

const sectionsOf = async (db: NavillDB, workspaceId: string) => (await db.workspaces.get(workspaceId))?.sections ?? [];

/** 新建分区，排在最后；返回新分区 */
export async function createSection(db: NavillDB, workspaceId: string, name?: string): Promise<Section> {
  return logged(db, async (log) => {
    const s: Section = { id: uid(), name: name?.trim() || tr('新分区') };
    await patch<Workspace>(db, 'workspaces', workspaceId, { sections: [...(await sectionsOf(db, workspaceId)), s] });
    log({ kind: 'create', targetType: 'workspace', targetId: workspaceId, summary: tr('新建分区{0}', q(s.name)) });
    return s;
  });
}

export async function renameSection(db: NavillDB, workspaceId: string, id: string, name: string) {
  const n = name.trim();
  if (!n) return;
  const list = await sectionsOf(db, workspaceId);
  if (!list.some((s) => s.id === id && s.name !== n)) return;
  await patch<Workspace>(db, 'workspaces', workspaceId, { sections: list.map((s) => (s.id === id ? { ...s, name: n } : s)) });
}

/** 按给出的 id 顺序重排分区（没列出的保持原顺序排在后面） */
export async function reorderSections(db: NavillDB, workspaceId: string, ids: string[]) {
  const list = await sectionsOf(db, workspaceId);
  const by = new Map(list.map((s) => [s.id, s]));
  const next = [...ids.flatMap((id) => by.get(id) ?? []), ...list.filter((s) => !ids.includes(s.id))];
  await patch<Workspace>(db, 'workspaces', workspaceId, { sections: next });
}

/** 上移 / 下移一位 */
export async function shiftSection(db: NavillDB, workspaceId: string, id: string, dir: -1 | 1) {
  const ids = (await sectionsOf(db, workspaceId)).map((s) => s.id);
  const i = ids.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  await reorderSections(db, workspaceId, ids);
}

/** 解散：去掉分区，其中的抽屉留在工作区里，不属于任何分区 */
export async function dissolveSection(db: NavillDB, workspaceId: string, id: string) {
  await logged(db, async (log) => {
    const list = await sectionsOf(db, workspaceId);
    const s = list.find((x) => x.id === id);
    if (!s) return;
    const drawers = await db.drawers.where('workspaceId').equals(workspaceId).filter((d) => d.sectionId === id).toArray();
    for (const d of drawers) await patch<Drawer>(db, 'drawers', d.id, { sectionId: undefined });
    await patch<Workspace>(db, 'workspaces', workspaceId, { sections: list.filter((x) => x.id !== id) });
    log({ kind: 'delete', targetType: 'workspace', targetId: workspaceId, summary: tr('解散分区{0}', q(s.name)) });
  });
}

/** 抽屉放进分区（sectionId 为 null 表示不属于任何分区），keys 是放下后该分区里抽屉的顺序 */
export async function placeDrawerInSection(db: NavillDB, drawerId: string, sectionId: string | null, keys: string[]) {
  await tx(db, async () => {
    const d = await db.drawers.get(drawerId);
    if (d && (d.sectionId ?? null) !== sectionId) await patch<Drawer>(db, 'drawers', drawerId, { sectionId: sectionId ?? undefined });
    for (const [i, id] of keys.entries()) await patch<Drawer>(db, 'drawers', id, { order: i });
  });
}
