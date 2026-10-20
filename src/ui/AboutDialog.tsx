import { Button } from '@cloudflare/kumo';
import { Bug, GithubLogo, House } from '@phosphor-icons/react';
import { Modal } from './Modal';
import { tr } from '@/src/i18n';

export const HOMEPAGE = 'https://navill.rei8t.dev';
export const REPO = 'https://github.com/reiy-leo/navill';

/** 关于本扩展：图标、版本、简介、主页与 GitHub 链接 */
import { Intro } from './Intro';

export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const m = browser.runtime.getManifest() as { version: string; version_name?: string };
  const links = [
    { href: HOMEPAGE, icon: <House />, label: tr('主页') },
    { href: REPO, icon: <GithubLogo />, label: 'GitHub' },
    { href: `${REPO}/issues`, icon: <Bug />, label: tr('反馈') },
  ];
  return (
    <Modal open={open} onClose={onClose} title={tr('关于本扩展')} size="base" hideTitle>
      <div className="flex flex-col items-center gap-3 text-center">
        <img src="/icon/128.png" alt="" className="h-16 w-16" />
        <div>
          <div className="text-lg font-semibold">Navill</div>
          <div className="text-xs text-kumo-subtle">{tr('版本 {0}', m.version_name ?? m.version)}</div>
        </div>
        <Intro />
        <div className="flex flex-nowrap justify-center gap-2">
          {links.map((l) => (
            <Button key={l.href} size="sm" variant="secondary" icon={l.icon} className="shrink-0 whitespace-nowrap" onClick={() => window.open(l.href, '_blank', 'noopener')}>{l.label}</Button>
          ))}
        </div>
        <div className="text-xs text-kumo-subtle">© {new Date().getFullYear()} Rei Leo</div>
      </div>
    </Modal>
  );
}
