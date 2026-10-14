import { INBOX_NAME, INBOX_ORDER, MODE_DEFAULT, PALETTE, TAG_ADULT, TAG_FAVORITE, TAG_TODO, type Mode, type NavillDB, type Tag, type Workspace } from '@/src/db';
import { put, tx, uid } from './core';

export const PRESET_MODES: Array<[string, string, 'default' | null]> = [
  [MODE_DEFAULT, '默认', 'default'],
  ['mode-work', '工作', null],
  ['mode-home', '居家', null],
  ['mode-talk', '演讲', null],
  ['mode-lend', '借用', null],
];
export const BUILTIN_TAGS: Array<[string, string, Tag['builtin']]> = [
  [TAG_ADULT, '18+', 'adult'],
  [TAG_FAVORITE, '收藏', 'favorite'],
  [TAG_TODO, '待办', 'todo'],
];

/** 确保系统工作区「待整理」存在（始终存在、不可删除） */
export async function ensureInbox(db: NavillDB): Promise<Workspace> {
  return tx(db, async () => {
    const existing = await db.workspaces.where('source').equals('inbox').first();
    if (existing) return existing;
    return put(db, 'workspaces', {
      id: uid(), name: INBOX_NAME, emoji: '📥', color: PALETTE[9], order: INBOX_ORDER, viewMode: 'tile',
      source: 'inbox', createdAt: Date.now(), updatedAt: 0,
    } as Workspace);
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
        id: MODE_DEFAULT, name: '默认', builtin: 'default', order: 0, hiddenWorkspaceIds: [], hiddenDrawerIds: [],
        showAdult: false, createdAt: now, updatedAt: 0,
      } as Mode);
    }
    for (const [i, [id, name, builtin]] of BUILTIN_TAGS.entries()) {
      if (await db.tags.get(id)) continue;
      await put(db, 'tags', { id, name, builtin, order: i, createdAt: now, updatedAt: 0 } as Tag);
    }
  });
}
