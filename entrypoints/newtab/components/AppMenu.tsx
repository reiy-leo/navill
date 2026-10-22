import { Button, Dialog, DropdownMenu, Input } from '@cloudflare/kumo';
import { Archive, CloudAlert, CloudCheck, CloudOff, CloudUpload, Copy, Ellipsis, Info, Plus, Search, SettingsIcon, Share2, SquareCheck, Store } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AboutDialog } from '@/src/ui/AboutDialog';
import { useApp, useQuery, useSelection } from '@/src/ui/state';
import { useSyncStatus } from '@/src/ui/useSettings';
import { SearchResults } from './SearchResults';
import type { Tab } from './Settings';

import { dateLocale, tr } from '@/src/i18n';
/** 导航栏右端：「搜索」按钮 + 一个「更多操作」菜单，分三组：
 * 新建工作区 · 整理 ｜ 归档 · 分身 · 分享 · 市场 ｜ 同步状态 · 设置 · 关于
 * vertical：侧边栏图标模式下上下排列 */
/** 导航栏右侧按钮：图标与工作区图标同大，默认灰，悬停加深 */
const NAV_BTN = 'text-kumo-subtle hover:text-kumo-default';

export function AppMenu({ onSearch, onSettings, onNewWorkspace, side = 'bottom', align, vertical }: { onSearch: () => void; onSettings: (tab?: Tab) => void; onNewWorkspace: () => void; side?: 'bottom' | 'right' | 'top' | 'left'; align?: 'start' | 'end'; vertical?: boolean }) {
  const { settings, setPanel } = useApp();
  const { organize, setOrganize } = useSelection();
  const sync = useSyncStatus();
  const SyncIcon = !settings.sync.enabled || sync.state === 'signed-out' ? CloudOff : sync.state === 'error' ? CloudAlert : sync.state === 'syncing' ? CloudUpload : CloudCheck;
  const syncLabel = !settings.sync.enabled ? tr('同步未开启') : sync.state === 'error' ? tr('同步失败') : sync.state === 'syncing' ? tr('正在同步…') : sync.lastSyncAt ? tr('已同步 {0}', new Date(sync.lastSyncAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })) : tr('同步');
  const [about, setAbout] = useState(false);
  const contentAlign = align ?? (side === 'bottom' ? 'end' : 'start');
  return (
    <div className={`flex items-center gap-1 ${vertical ? 'flex-col' : ''}`}>
    <Button variant="ghost" size="xs" shape="square" className={NAV_BTN} icon={<Search size={14} />} onClick={onSearch} aria-label={tr('搜索')} title={`${tr('搜索')} (/)`} />
    <DropdownMenu>
      <DropdownMenu.Trigger render={<Button variant={organize ? 'secondary' : 'ghost'} size="xs" shape="square" className={organize ? undefined : NAV_BTN} icon={<Ellipsis size={14} />} aria-label={tr('更多操作')} title={tr('更多操作')} />} />
      <DropdownMenu.Content side={side} align={contentAlign}>
        <DropdownMenu.Item icon={Plus} onClick={onNewWorkspace}>{tr('新建工作区')}</DropdownMenu.Item>
        <DropdownMenu.Item icon={SquareCheck} onClick={() => setOrganize(!organize)}>{organize ? tr('退出整理') : tr('开始整理')}</DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item icon={Archive} onClick={() => setPanel('archive')}>{tr('归档')}</DropdownMenu.Item>
        <DropdownMenu.Item icon={Copy} onClick={() => setPanel('aliases')}>{tr('分身')}</DropdownMenu.Item>
        <DropdownMenu.Item icon={Share2} onClick={() => setPanel('shares')}>{tr('分享')}</DropdownMenu.Item>
        <DropdownMenu.Item icon={Store} onClick={() => setPanel('market')}>{tr('市场')}</DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item icon={SyncIcon} onClick={() => onSettings('sync')}>{syncLabel}</DropdownMenu.Item>
        <DropdownMenu.Item icon={SettingsIcon} onClick={() => onSettings()}>{tr('设置')}</DropdownMenu.Item>
        <DropdownMenu.Item icon={Info} onClick={() => setAbout(true)}>{tr('关于')}</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
    <AboutDialog open={about} onClose={() => setAbout(false)} />
    </div>
  );
}

/** 屏幕中间的搜索框；按 / 或 ⌘L / Ctrl+L 打开，Esc 关闭 */
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { query, setQuery } = useQuery();
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
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-kumo-subtle" size={18} />
          <Input ref={ref} size="lg" className="w-full pl-10" placeholder={tr('搜索书签，#标签 筛选')} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={tr('搜索')} autoFocus />
        </div>
        {query.trim() && <div className="-m-1 min-h-0 flex-1 overflow-y-auto p-1"><SearchResults onOpen={onClose} /></div>}
      </Dialog>
    </Dialog.Root>
  );
}
