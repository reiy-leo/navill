import { Loader, TooltipProvider } from '@cloudflare/kumo';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { db } from '@/src/db';
import type { BookmarkNode } from '@/src/lib/edge-workspace';
import { parseNetscapeHtml } from '@/src/lib/io/html';
import { ensureSeed } from '@/src/lib/store';
import { ContextMenuProvider } from '@/src/ui/ContextMenu';
import { DialogsProvider } from '@/src/ui/dialogs';
import { AppStateProvider, useApp } from '@/src/ui/state';
import { ArchiveView } from './components/ArchiveView';
import { Header } from './components/Header';
import ImportPreview from './components/ImportPreview';
import { Nav, useVisibleWorkspaces } from './components/Nav';
import { OrganizeBar } from './components/OrganizeBar';
import { SearchResults } from './components/SearchResults';
import { SettingsDialog } from './components/Settings';
import Welcome from './components/Welcome';
import { WorkspaceView } from './components/WorkspaceView';

export default function App() {
  return (
    <TooltipProvider delay={300}>
      <AppStateProvider>
        <DialogsProvider>
          <ContextMenuProvider>
            <Root />
          </ContextMenuProvider>
        </DialogsProvider>
      </AppStateProvider>
    </TooltipProvider>
  );
}

type Screen = { kind: 'auto' } | { kind: 'preview'; tree?: BookmarkNode; dedupe: boolean };

function Root() {
  const [screen, setScreen] = useState<Screen>({ kind: 'auto' });
  const [seeded, setSeeded] = useState(false);
  const htmlInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void ensureSeed(db).then(() => setSeeded(true));
  }, []);
  const onboarded = useLiveQuery(async () => {
    const [imported, skipped] = await Promise.all([db.meta.get('importedAt'), db.meta.get('onboardedAt')]);
    return Boolean(imported || skipped);
  });

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
  const { settings, workspaceId, query, view } = useApp();
  const workspaces = useVisibleWorkspaces();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const current = workspaces?.find((w) => w.id === workspaceId) ?? workspaces?.[0];
  const top = settings.navLayout === 'top';

  return (
    <div className={`flex h-full ${top ? 'flex-col' : ''}`}>
      {!top && <Nav current={current?.id} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onSettings={() => setSettingsOpen(true)} />
        {top && <Nav current={current?.id} />}
        <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-24 pt-4">
          {query.trim() ? <SearchResults /> : view === 'archive' ? <ArchiveView /> : current ? <WorkspaceView workspaceId={current.id} /> : (
            <p className="p-8 text-center text-sm text-kumo-subtle">当前场景下没有可见的工作区，可以在设置 → 场景中调整。</p>
          )}
        </main>
      </div>
      <OrganizeBar />
      {settingsOpen && <SettingsDialog open onClose={() => setSettingsOpen(false)} onReimport={onReimport} />}
    </div>
  );
}
