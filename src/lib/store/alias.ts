import type { AliasGroup, NavillDB } from '@/src/db';
import { del, put, tx, uid } from './core';

/** 如果把 source 挂到 target，会不会形成循环（target 直接或间接挂载了 source 之后又被 source 挂载） */
export function wouldCycle(groups: Pick<AliasGroup, 'sourceDrawerId' | 'targetDrawerId'>[], source: string, target: string) {
  if (source === target) return true;
  // 新边 source → target（target 显示 source 的内容）。从 source 出发沿「被谁挂载」反查是否能到 target 的上游
  const showsInto = new Map<string, string[]>(); // drawer -> drawers that display it
  for (const g of groups) showsInto.set(g.sourceDrawerId, [...(showsInto.get(g.sourceDrawerId) ?? []), g.targetDrawerId]);
  // 循环：沿 target 继续往下游走能回到 source
  const seen = new Set<string>();
  const stack = [target];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === source) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...(showsInto.get(cur) ?? []));
  }
  return false;
}

export class AliasCycleError extends Error {
  constructor() {
    super('不能这样挂载：会形成循环');
  }
}

/** 创建分身书签组：把 source 抽屉的全部书签挂载到 target 抽屉 */
export async function mountDrawer(db: NavillDB, sourceDrawerId: string, targetDrawerId: string) {
  return tx(db, async () => {
    const groups = await db.aliasGroups.toArray();
    if (groups.some((g) => g.sourceDrawerId === sourceDrawerId && g.targetDrawerId === targetDrawerId)) return null;
    if (wouldCycle(groups, sourceDrawerId, targetDrawerId)) throw new AliasCycleError();
    const order = groups.filter((g) => g.targetDrawerId === targetDrawerId).length;
    return put<AliasGroup>(db, 'aliasGroups', {
      id: uid(), sourceDrawerId, targetDrawerId, order, createdAt: Date.now(), updatedAt: 0,
    });
  });
}

export async function unmount(db: NavillDB, groupId: string) {
  await del(db, 'aliasGroups', groupId);
}

/** 把分身转为独立书签：复制一份书签，位置改指向副本 */
export async function detachAlias(db: NavillDB, placementId: string) {
  await tx(db, async () => {
    const p = await db.placements.get(placementId);
    if (!p || !p.isAlias) return;
    const b = await db.bookmarks.get(p.bookmarkId);
    if (!b) return;
    const copy = await put(db, 'bookmarks', { ...b, id: uid(), openCount: 0, lastOpenedAt: undefined, createdAt: Date.now() });
    await put(db, 'placements', { ...p, bookmarkId: copy.id, isAlias: false });
  });
}
