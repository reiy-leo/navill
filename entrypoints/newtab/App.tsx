import { PageBackground } from '@/src/ui/PageBackground';
import { SideDrawer } from '@/src/ui/SideDrawer';
import { AliasesPanel } from './components/AliasesPanel';
import { Loader, TooltipProvider } from '@cloudflare/kumo';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, useCallback } from 'react';
import { db } from '@/src/db';
import type { BookmarkNode } from '@/src/lib/edge-workspace';
import { parseNetscapeHtml } from '@/src/lib/io/html';
import { ensureSeed, parseWorkspaceIcons, seedFromHistory } from '@/src/lib/store';
import { ContextMenuProvider } from '@/src/ui/ContextMenu';
import { DialogsProvider } from '@/src/ui/dialogs';
import { useTone } from '@/src/ui/colors';
import { AppStateProvider, useApp } from '@/src/ui/state';
import { ArchiveView } from './components/ArchiveView';
import { MarketView } from './components/MarketView';
import { SharesView } from './components/SharesView';
import { SearchDialog } from './components/AppMenu';
import { ModeSwitcher } from '@/src/ui/ModeSwitcher';
import { shortcutSync, useLogToasts, useShortcuts } from '@/src/ui/feedback';
import { Toaster } from '@/src/ui/toast';
import type { Tab } from './components/Settings';
import ImportPreview from './components/ImportPreview';
import { HomeView } from './components/HomeView';
import { Nav, useVisibleWorkspaces } from './components/Nav';
import { OrganizeBar } from './components/OrganizeBar';
import { lastSettingsTab, SettingsDialog } from './components/Settings';
import Welcome from './components/Welcome';
import { WorkspaceView } from './components/WorkspaceView';

import { tr } from '@/src/i18n';
export default function App() {
  return (
    <TooltipProvider delay={300}>
      <AppStateProvider>
        <DialogsProvider>
          <ContextMenuProvider>
            <Root />
            <Toasts />
          </ContextMenuProvider>
        </DialogsProvider>
      </AppStateProvider>
    </TooltipProvider>
  );
}

function Toasts() {
  const { settings } = useApp();
  useLogToasts(settings);
  return <Toaster position={settings.toast.position} style={settings.toast.style} />;
}

type Screen = { kind: 'auto' } | { kind: 'preview'; tree?: BookmarkNode; dedupe: boolean };

function Root() {
  const [screen, setScreen] = useState<Screen>({ kind: 'auto' });
  const [seeded, setSeeded] = useState(false);
  const htmlInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // 每次打开新标签页也检查一次（同步进来的名称可能带 emoji）
    void ensureSeed(db).then(() => parseWorkspaceIcons(db)).catch(() => 0).then(() => setSeeded(true));
  }, []);
  const onboarded = useLiveQuery(async () => {
    const [imported, skipped] = await Promise.all([db.meta.get('importedAt'), db.meta.get('onboardedAt')]);
    return Boolean(imported || skipped);
  });
  // 有浏览记录权限时，用本机访问次数给书签打开次数打底（最多 6 小时一次；导入后立即统计）
  useEffect(() => { if (onboarded) void seedFromHistory(db).catch((e) => console.warn('[Navill] 读取浏览记录失败', e)); }, [onboarded]);

  if (onboarded === undefined || !seeded) {
    return <div className="flex h-full items-center justify-center"><Loader size="lg" /></div>;
  }
  if (screen.kind === 'preview') {
    const back = () => setScreen({ kind: 'auto' });
    return <ImportPreview sourceTree={screen.tree} dedupe={screen.dedupe} onCancel={back} onDone={back} />;
  }
  if (!onboarded) return <Welcome onImport={(tree) => setScreen({ kind: 'preview', tree, dedupe: false })} />;
  return (
    <>
      <Main onReimport={(source) => (source === 'browser' ? setScreen({ kind: 'preview', dedupe: true }) : htmlInput.current?.click())} />
      <input
        ref={htmlInput}
        type="file"
        accept=".html,.htm"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) setScreen({ kind: 'preview', tree: parseNetscapeHtml(await f.text()), dedupe: true });
        }}
      />
    </>
  );
}

function Main({ onReimport }: { onReimport: (s: 'browser' | 'html') => void }) {
  const { settings, workspaceId, view } = useApp();
  const workspaces = useVisibleWorkspaces();
  const [settingsOpen, setSettingsOpen] = useState<Tab | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const latest = useRef(settings);
  latest.current = settings;
  const sync = useCallback(() => void shortcutSync(db, latest.current), []);
  useShortcuts({ onSearch: openSearch, onSync: sync });
  const menu = { onSearch: openSearch, onSettings: (tab?: Tab) => setSettingsOpen(tab ?? lastSettingsTab()) };
  const current = workspaces?.find((w) => w.id === workspaceId) ?? workspaces?.[0];
  const wsColor = useTone(current?.color);
  const pos = settings.navPosition;
  const bar = pos === 'top' || pos === 'bottom';
  const right = pos === 'right';
  useEffect(() => { document.documentElement.dataset.surface = settings.surface; }, [settings.surface]);

  return (
    <div className={`relative isolate flex h-full overflow-hidden ${bar ? 'flex-col' : right ? 'flex-row-reverse' : ''}`} style={{ '--ws-color': wsColor } as React.CSSProperties}>
      <PageBackground settings={settings} color={wsColor} workspace={view === 'workspace'} />
      {!bar && <Nav current={current?.id} {...menu} />}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {pos === 'top' && <Nav current={current?.id} {...menu} />}
        <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-24 pt-4">
          {view === 'home' ? <HomeView /> : current ? <WorkspaceView workspaceId={current.id} /> : (
            <p className="p-8 text-center text-sm text-kumo-subtle">{tr('当前场景下没有可见的工作区，可以在设置 → 场景中调整。')}</p>
          )}
        </main>
        {pos === 'bottom' && <Nav current={current?.id} {...menu} />}
      </div>
      <OrganizeBar />
      {/* 场景切换固定在页面右下角；侧边栏在右侧时移到左下角、底部横条时上移，避开应用菜单 */}
      <div className={`fixed bottom-4 z-20 ${right ? 'left-4' : 'right-4'} ${pos === 'bottom' ? 'bottom-16' : ''}`}><ModeSwitcher side="top" /></div>
      {settingsOpen && <SettingsDialog open initialTab={settingsOpen} onClose={() => setSettingsOpen(null)} onReimport={onReimport} />}
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <PanelDrawer />
    </div>
  );
}

/** 管理归档 / 分身 / 分享 / 市场：右侧抽屉（桌面半屏，窄屏全宽） */
function PanelDrawer() {
  const { panel, setPanel } = useApp();
  const last = useRef(panel);
  if (panel) last.current = panel; // 关闭动画期间保留内容
  const p = panel ?? last.current;
  const title = p === 'archive' ? tr('管理归档') : p === 'aliases' ? tr('管理分身') : p === 'shares' ? tr('管理分享') : tr('市场');
  return (
    <SideDrawer open={!!panel} onClose={() => setPanel(null)} title={title}>
      {p === 'archive' ? <ArchiveView /> : p === 'aliases' ? <AliasesPanel /> : p === 'shares' ? <SharesView /> : p === 'market' ? <MarketView /> : null}
    </SideDrawer>
  );
}
