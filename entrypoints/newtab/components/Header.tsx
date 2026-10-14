import { Button, Input } from '@cloudflare/kumo';
import { CheckSquare, CloudCheck, CloudSlash, CloudArrowUp, CloudWarning, GearSix, MagnifyingGlass } from '@phosphor-icons/react';
import { useEffect, useRef } from 'react';
import { ModeSwitcher } from '@/src/ui/ModeSwitcher';
import { useApp } from '@/src/ui/state';
import { useSyncStatus } from '@/src/ui/useSettings';

export function Header({ onSettings }: { onSettings: () => void }) {
  const { query, setQuery, organize, setOrganize, settings } = useApp();
  const sync = useSyncStatus();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const SyncIcon = !settings.sync.enabled || sync.state === 'signed-out' ? CloudSlash : sync.state === 'error' ? CloudWarning : sync.state === 'syncing' ? CloudArrowUp : CloudCheck;
  const syncTitle = !settings.sync.enabled ? '同步未开启' : sync.state === 'error' ? `同步失败：${sync.message}` : sync.lastSyncAt ? `上次同步 ${new Date(sync.lastSyncAt).toLocaleString('zh-CN')}` : '同步';

  return (
    <header className="flex items-center gap-2 px-4 py-2">
      <div className="relative max-w-xl flex-1">
        <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-kumo-subtle" size={16} />
        <Input
          ref={ref}
          className="w-full pl-8"
          placeholder="搜索书签（/ 聚焦，#标签 筛选）"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && (setQuery(''), ref.current?.blur())}
          aria-label="搜索"
        />
      </div>
      <div className="flex-1" />
      <ModeSwitcher />
      <Button size="sm" variant={organize ? 'primary' : 'ghost'} icon={<CheckSquare />} onClick={() => setOrganize(!organize)}>整理</Button>
      <Button size="sm" variant="ghost" shape="square" icon={<SyncIcon />} title={syncTitle} aria-label={syncTitle} onClick={onSettings} />
      <Button size="sm" variant="ghost" shape="square" icon={<GearSix />} aria-label="设置" onClick={onSettings} />
    </header>
  );
}
