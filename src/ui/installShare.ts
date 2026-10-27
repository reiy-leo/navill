import { db } from '@/src/db';
import { tr } from '@/src/i18n';
import { getPublicShare, installSharedDrawer, installSharedWorkspace, type PublicShare, type PublicShareDetail } from '@/src/lib/share';
import { useDialogs } from './dialogs';
import { useApp } from './state';
import { toast } from './toast';

type ShareDrawer = PublicShareDetail['payload']['drawers'][number];

/** 安装市场分享：抽屉 → 选工作区 + 改名；工作区 → 新建同名工作区（可改名） */
export function useInstallShare() {
  const dialogs = useDialogs();
  const { panel, setPanel } = useApp();
  /** 侧边抽屉（市场）是模态的，会挡住安装弹窗：弹窗期间先收起，结束后再打开 */
  const withPanelHidden = async <T,>(fn: () => Promise<T>) => {
    const prev = panel;
    if (prev) setPanel(null);
    try { return await fn(); } finally { if (prev) setPanel(prev); }
  };
  const fail = (e: unknown) => toast(e instanceof Error ? e.message : String(e));

  const installDrawer = async (d: ShareDrawer) => {
    const t = await withPanelHidden(() => dialogs.pickTarget({ title: tr('安装抽屉'), workspacesOnly: true, sections: true, name: d.name, okText: tr('安装') }));
    if (!t) return;
    const name = t.name || d.name;
    try {
      await installSharedDrawer(db, t.workspaceId, { ...d, name }, t.sectionId);
      toast(tr('已安装「{0}」，共 {1} 个书签', name, d.bookmarks.length));
    } catch (e) { fail(e); }
  };

  const installShare = async (share: PublicShare) => {
    let detail: PublicShareDetail;
    try { detail = await getPublicShare(share.id); } catch (e) { return fail(e); }
    const p = detail.payload;
    if (share.kind === 'drawer') {
      const d = p.drawers[0] ?? { name: share.title, bookmarks: p.loose ?? [] };
      return installDrawer({ ...d, name: d.name || share.title });
    }
    const name = (await withPanelHidden(() => dialogs.prompt(tr('安装工作区'), p.workspace.name || share.title)))?.trim();
    if (!name) return;
    try {
      await installSharedWorkspace(db, p, name);
      toast(tr('已安装「{0}」，共 {1} 个书签', name, share.bookmarkCount));
    } catch (e) { fail(e); }
  };

  return { installDrawer, installShare };
}
