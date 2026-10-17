import { MODE_DEFAULT, PALETTE, type Mode, type NavillDB } from '@/src/db';
import { del, patch, put, tx, uid } from './core';

import { tr } from '@/src/i18n';
export async function createMode(db: NavillDB, name: string) {
  const all = await db.modes.toArray();
  return put<Mode>(db, 'modes', {
    id: uid(), name: name.trim() || tr('新场景'), builtin: null, order: all.reduce((m, x) => Math.max(m, x.order), -1) + 1,
    hiddenWorkspaceIds: [], hiddenDrawerIds: [], showAdult: false, createdAt: Date.now(), updatedAt: 0,
    color: PALETTE[all.length % PALETTE.length], icon: 'circle-dot',
  });
}

export async function setModeLook(db: NavillDB, id: string, look: { color?: string; icon?: string }) {
  await patch<Mode>(db, 'modes', id, look);
}

export async function renameMode(db: NavillDB, id: string, name: string) {
  if (id === MODE_DEFAULT || !name.trim()) return;
  await patch<Mode>(db, 'modes', id, { name: name.trim() });
}

export async function deleteMode(db: NavillDB, id: string) {
  if (id === MODE_DEFAULT) return;
  await del(db, 'modes', id);
}

export async function setShowAdult(db: NavillDB, id: string, showAdult: boolean) {
  await patch<Mode>(db, 'modes', id, { showAdult });
}

/** 设置某工作区 / 抽屉在某场景中是否可见；「默认」场景的可见性不可编辑 */
export async function setVisible(db: NavillDB, modeId: string, kind: 'workspace' | 'drawer', id: string, visible: boolean) {
  if (modeId === MODE_DEFAULT) return;
  await tx(db, async () => {
    const m = await db.modes.get(modeId);
    if (!m) return;
    const key = kind === 'workspace' ? 'hiddenWorkspaceIds' : 'hiddenDrawerIds';
    const set = new Set(m[key]);
    if (visible) set.delete(id);
    else set.add(id);
    await patch<Mode>(db, 'modes', modeId, { [key]: [...set] });
  });
}

/** 新建时选择「仅当前场景可见」：在其他所有非默认场景中隐藏 */
export async function hideEverywhereExcept(db: NavillDB, kind: 'workspace' | 'drawer', id: string, keepModeId: string) {
  const modes = await db.modes.toArray();
  for (const m of modes) {
    if (m.id === keepModeId || m.id === MODE_DEFAULT) continue;
    await setVisible(db, m.id, kind, id, false);
  }
}
