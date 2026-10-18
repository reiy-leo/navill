import { Button, Dialog, DropdownMenu, Input } from '@cloudflare/kumo';
import { Archive, Check, CheckSquare, Plus, CloudArrowUp, CloudCheck, CloudSlash, CloudWarning, DotsThree, ShareNetwork, Storefront, CopySimple, GearSix, Info, MagnifyingGlass } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { AboutDialog } from '@/src/ui/AboutDialog';
import { SideDrawer } from '@/src/ui/SideDrawer';
import { AliasesPanel } from './AliasesPanel';
import { useApp } from '@/src/ui/state';
import { useSyncStatus } from '@/src/ui/useSettings';
import { SearchResults } from './SearchResults';
import type { Tab } from './Settings';

import { dateLocale, tr } from '@/src/i18n';
/** ⋯ 菜单：新建工作区 · 开始整理 · 管理归档 · 管理分身 · 管理分享 · 搜索 | 同步 · 设置 · 关于本扩展（顶部横铺放在工作区条右端，侧边栏放在标题旁） */
export function AppMenu({ onSearch, onSettings, onNewWorkspace, side = 'bottom', align }: { onSearch: () => void; onSettings: (tab?: Tab) => void; onNewWorkspace: () => void; side?: 'bottom' | 'right' | 'top' | 'left'; align?: 'start' | 'end' }) {
  const { organize, setOrganize, settings, view, setView } = useApp();
  const sync = useSyncStatus();
  const SyncIcon = !settings.sync.enabled || sync.state === 'signed-out' ? CloudSlash : sync.state === 'error' ? CloudWarning : sync.state === 'syncing' ? CloudArrowUp : CloudCheck;
  const syncLabel = !settings.sync.enabled ? tr('同步未开启') : sync.state === 'error' ? tr('同步失败') : sync.state === 'syncing' ? tr('正在同步…') : sync.lastSyncAt ? tr('已同步 {0}', new Date(sync.lastSyncAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })) : tr('同步');
  const [about, setAbout] = useState(false);
  const [aliases, setAliases] = useState(false);
  return (
    <>
    <DropdownMenu>
      <DropdownMenu.Trigger render={<Button variant={organize ? 'secondary' : 'ghost'} size="xs" shape="square" icon={<DotsThree weight="bold" />} aria-label={tr('更多')} title={tr('更多')} />} />
      <DropdownMenu.Content side={side} align={align ?? (side === 'bottom' ? 'end' : 'start')}>
        <DropdownMenu.Item icon={Plus} onClick={onNewWorkspace}>{tr('新建工作区')}</DropdownMenu.Item>
        <DropdownMenu.Item icon={CheckSquare} onClick={() => setOrganize(!organize)}>{organize ? tr('退出整理') : tr('开始整理')}</DropdownMenu.Item>
        <DropdownMenu.Item icon={view === 'archive' ? Check : Archive} onClick={() => setView('archive')}>{tr('管理归档')}</DropdownMenu.Item>
        <DropdownMenu.Item icon={CopySimple} onClick={() => setAliases(true)}>{tr('管理分身')}</DropdownMenu.Item>
        <DropdownMenu.Item icon={view === 'shares' ? Check : ShareNetwork} onClick={() => setView('shares')}>{tr('管理分享')}</DropdownMenu.Item>
        <DropdownMenu.Item icon={view === 'market' ? Check : Storefront} onClick={() => setView('market')}>{tr('查看市场')}</DropdownMenu.Item>
        <DropdownMenu.Item icon={MagnifyingGlass} onClick={onSearch}>{tr('搜索')}<DropdownMenu.Shortcut>/</DropdownMenu.Shortcut></DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item icon={SyncIcon} onClick={() => onSettings('sync')}>{syncLabel}</DropdownMenu.Item>
        <DropdownMenu.Item icon={GearSix} onClick={() => onSettings()}>{tr('设置')}</DropdownMenu.Item>
        <DropdownMenu.Item icon={Info} onClick={() => setAbout(true)}>{tr('关于本扩展')}</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
    <AboutDialog open={about} onClose={() => setAbout(false)} />
    <SideDrawer open={aliases} onClose={() => setAliases(false)} title={tr('管理分身')}><AliasesPanel /></SideDrawer>
    </>
  );
}

/** 屏幕中间的搜索框；按 / 或 ⌘L / Ctrl+L 打开，Esc 关闭 */
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { query, setQuery } = useApp();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) { setQuery(''); return; }
    const t = setTimeout(() => ref.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open, setQuery]);
  return (
    <Dialog.Root open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <Dialog size="lg" className="flex max-h-[75vh] flex-col gap-3 p-4">
        <Dialog.Title className="sr-only">{tr('搜索书签')}</Dialog.Title>
        <div className="relative">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-kumo-subtle" size={18} />
          <Input ref={ref} size="lg" className="w-full pl-10" placeholder={tr('搜索书签，#标签 筛选')} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={tr('搜索')} autoFocus />
        </div>
        {query.trim() && <div className="-m-1 min-h-0 flex-1 overflow-y-auto p-1"><SearchResults onOpen={onClose} /></div>}
      </Dialog>
    </Dialog.Root>
  );
}
