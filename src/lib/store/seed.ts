import { INBOX_ID, INBOX_NAME, INBOX_ORDER, MODE_DEFAULT, PALETTE, TAG_ADULT, TAG_FAVORITE, TAG_TODO, type AliasGroup, type Drawer, type Mode, type NavillDB, type Placement, type Tag, type Workspace } from '@/src/db';
import { del, patch, put, tx } from './core';

import { tr } from '@/src/i18n';
export const PRESET_MODES: Array<[string, string, 'default' | null]> = [
  [MODE_DEFAULT, tr('默认'), 'default'],
  ['mode-work', tr('工作'), null],
  ['mode-home', tr('居家'), null],
  ['mode-talk', tr('演讲'), null],
  ['mode-lend', tr('借用'), null],
];
export const BUILTIN_TAGS: Array<[string, string, Tag['builtin']]> = [
  [TAG_ADULT, '18+', 'adult'],
  [TAG_FAVORITE, tr('收藏'), 'favorite'],
  [TAG_TODO, tr('待办'), 'todo'],
];

/** 确保系统工作区「待整理」存在（始终存在、不可删除） */
export async function ensureInbox(db: NavillDB): Promise<Workspace> {
  return tx(db, async () => {
    const existing = await mergeInboxes(db);
    if (existing) return existing;
    return put(db, 'workspaces', {
      id: INBOX_ID, name: INBOX_NAME, emoji: '📥', color: PALETTE[9], order: INBOX_ORDER, viewMode: 'tile',
      source: 'inbox', createdAt: Date.now(), updatedAt: 0,
    } as Workspace);
  });
}

/**
 * 多台设备各自创建过「待整理」时，同步后会出现多个：保留固定 ID 的（没有则最早创建的），
 * 其余的抽屉和书签并入，同名抽屉合并，然后删除多余的。返回保留的那个。
 */
export async function mergeInboxes(db: NavillDB): Promise<Workspace | undefined> {
  return tx(db, async () => {
    const all = await db.workspaces.where('source').equals('inbox').toArray();
    if (all.length <= 1) return all[0];
    all.sort((a, b) => (a.id === INBOX_ID ? -1 : b.id === INBOX_ID ? 1 : a.createdAt - b.createdAt || a.id.localeCompare(b.id)));
    const keep = all[0]!;
    const extra = all.slice(1);
    const kept: Drawer[] = await db.drawers.where('workspaceId').equals(keep.id).toArray();
    let order = kept.reduce((m, d) => Math.max(m, d.order), -1) + 1;
    for (const ws of extra) {
      for (const d of await db.drawers.where('workspaceId').equals(ws.id).toArray()) {
        const same = kept.find((k) => k.name === d.name);
        const ps: Placement[] = await db.placements.where('drawerId').equals(d.id).toArray();
        if (same) {
          for (const p of ps) await patch<Placement>(db, 'placements', p.id, { workspaceId: keep.id, drawerId: same.id });
          for (const g of await db.aliasGroups.toArray()) {
            if (g.sourceDrawerId === d.id) await patch<AliasGroup>(db, 'aliasGroups', g.id, { sourceDrawerId: same.id });
            if (g.targetDrawerId === d.id) await patch<AliasGroup>(db, 'aliasGroups', g.id, { targetDrawerId: same.id });
          }
          await del(db, 'drawers', d.id);
        } else {
          await patch<Drawer>(db, 'drawers', d.id, { workspaceId: keep.id, order: order++ });
          for (const p of ps) await patch<Placement>(db, 'placements', p.id, { workspaceId: keep.id });
          kept.push({ ...d, workspaceId: keep.id });
        }
      }
      for (const p of await db.placements.where('workspaceId').equals(ws.id).toArray()) await patch<Placement>(db, 'placements', p.id, { workspaceId: keep.id });
      await del(db, 'workspaces', ws.id);
    }
    return keep;
  });
}

/** 预设场景与内置标签；只补缺失的，不覆盖用户修改 */
export async function ensureSeed(db: NavillDB): Promise<void> {
  await tx(db, async () => {
    await ensureInbox(db);
    const now = Date.now();
    if ((await db.meta.get('modesSeeded')) === undefined) {
      for (const [i, [id, name, builtin]] of PRESET_MODES.entries()) {
        if (await db.modes.get(id)) continue;
        await put(db, 'modes', {
          id, name, builtin, order: i, hiddenWorkspaceIds: [], hiddenDrawerIds: [],
          showAdult: false, createdAt: now, updatedAt: 0,
        } as Mode);
      }
      await db.meta.put({ key: 'modesSeeded', value: now });
    } else if (!(await db.modes.get(MODE_DEFAULT))) {
      await put(db, 'modes', {
        id: MODE_DEFAULT, name: tr('默认'), builtin: 'default', order: 0, hiddenWorkspaceIds: [], hiddenDrawerIds: [],
        showAdult: false, createdAt: now, updatedAt: 0,
      } as Mode);
    }
    for (const [i, [id, name, builtin]] of BUILTIN_TAGS.entries()) {
      if (await db.tags.get(id)) continue;
      await put(db, 'tags', { id, name, builtin, order: i, createdAt: now, updatedAt: 0 } as Tag);
    }
  });
}
