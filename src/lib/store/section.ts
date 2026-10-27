import type { Drawer, NavillDB, Placement, Section, Workspace } from '@/src/db';
import { patch, tx, uid } from './core';
import { logged, q } from '../log';

import { tr } from '@/src/i18n';
import { aliasDrawerTo } from './alias';

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

const drawersIn = (db: NavillDB, workspaceId: string, sectionId: string) =>
  db.drawers.where('workspaceId').equals(workspaceId).filter((d) => d.sectionId === sectionId && !d.archivedAt).sortBy('order');

/** 整个分区连同抽屉移到另一个工作区，排在那边分区的最后 */
export async function moveSection(db: NavillDB, workspaceId: string, id: string, targetId: string) {
  if (workspaceId === targetId) return;
  await logged(db, async (log) => {
    const list = await sectionsOf(db, workspaceId);
    const s = list.find((x) => x.id === id);
    const target = await db.workspaces.get(targetId);
    if (!s || !target) return;
    const siblings = await db.drawers.where('workspaceId').equals(targetId).toArray();
    let order = siblings.reduce((m, x) => Math.max(m, x.order), -1) + 1;
    // 归档的抽屉也一起走，恢复时还在这个分区
    const drawers = await db.drawers.where('workspaceId').equals(workspaceId).filter((d) => d.sectionId === id).sortBy('order');
    for (const d of drawers) {
      await patch<Drawer>(db, 'drawers', d.id, { workspaceId: targetId, order: order++ });
      for (const p of await db.placements.where('drawerId').equals(d.id).toArray()) await patch<Placement>(db, 'placements', p.id, { workspaceId: targetId });
    }
    await patch<Workspace>(db, 'workspaces', workspaceId, { sections: list.filter((x) => x.id !== id) });
    await patch<Workspace>(db, 'workspaces', targetId, { sections: [...(target.sections ?? []), s] });
    log({ kind: 'move', targetType: 'workspace', targetId: targetId, summary: tr('分区{0}移动到工作区{1}', q(s.name), q(target.name)) });
  });
}

/** 分身到另一个工作区：那边建同名分区，里面每个抽屉都是这边抽屉的分身（挂载） */
export async function cloneSectionTo(db: NavillDB, workspaceId: string, id: string, targetId: string) {
  const s = (await sectionsOf(db, workspaceId)).find((x) => x.id === id);
  if (!s) return;
  const ns = await createSection(db, targetId, s.name);
  for (const d of await drawersIn(db, workspaceId, id)) await aliasDrawerTo(db, d.id, targetId, ns.id);
}

/** 归档：分区里的抽屉全部归档，分区本身去掉（恢复的抽屉回到工作区，不属于分区） */
export async function archiveSection(db: NavillDB, workspaceId: string, id: string) {
  await logged(db, async (log) => {
    const list = await sectionsOf(db, workspaceId);
    const s = list.find((x) => x.id === id);
    if (!s) return;
    const now = Date.now();
    for (const d of await drawersIn(db, workspaceId, id)) await patch<Drawer>(db, 'drawers', d.id, { archivedAt: now, sectionId: undefined });
    for (const d of await db.drawers.where('workspaceId').equals(workspaceId).filter((x) => x.sectionId === id).toArray()) await patch<Drawer>(db, 'drawers', d.id, { sectionId: undefined });
    await patch<Workspace>(db, 'workspaces', workspaceId, { sections: list.filter((x) => x.id !== id) });
    log({ kind: 'archive', targetType: 'workspace', targetId: workspaceId, summary: tr('归档分区{0}', q(s.name)) });
  });
}
