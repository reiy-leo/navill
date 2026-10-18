import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MODE_DEFAULT, db, type Mode } from '@/src/db';
import type { Settings } from '@/src/lib/settings';
import { visibilityOf, type Visibility } from '@/src/lib/view';
import { useSettings } from './useSettings';

const LAST_VIEW_KEY = 'navill-last-view';

export type MainView = 'home' | 'workspace' | 'archive' | 'shares' | 'market';

interface AppState {
  settings: Settings;
  updateSettings: (p: Partial<Settings>) => Promise<Settings>;
  ready: boolean;
  modes: Mode[];
  mode: Mode | undefined;
  visibility: Visibility;
  organize: boolean;
  setOrganize: (v: boolean) => void;
  selection: Set<string>; // placement ids
  toggleSelect: (placementId: string, on?: boolean) => void;
  clearSelection: () => void;
  query: string;
  setQuery: (q: string) => void;
  view: MainView;
  setView: (v: MainView) => void;
  workspaceId: string | undefined;
  selectWorkspace: (id: string) => void;
}

const Ctx = createContext<AppState | null>(null);
export const useApp = () => useContext(Ctx)!;

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [settings, updateSettings, ready] = useSettings();
  const modes = useLiveQuery(() => db.modes.orderBy('order').toArray(), []) ?? [];
  const mode = modes.find((m) => m.id === settings.currentModeId) ?? modes.find((m) => m.id === MODE_DEFAULT);
  const visibility = useMemo(() => visibilityOf(mode), [mode]);
  const [organize, setOrganizeRaw] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  // 「上次打开的」也记住主页：本机 localStorage，不参与同步（与 lastWorkspaceId 同为设备级）
  const [view, setViewRaw] = useState<MainView>(() =>
    settings.startWorkspace === 'home' || (settings.startWorkspace === 'last' && localStorage.getItem(LAST_VIEW_KEY) === 'home') ? 'home' : 'workspace',
  );
  const [viewTouched, setViewTouched] = useState(false);
  const setView = useCallback((v: MainView) => {
    setViewTouched(true);
    setViewRaw(v);
    if (v === 'home' || v === 'workspace') localStorage.setItem(LAST_VIEW_KEY, v);
  }, []);
  // 设置异步载入：首次就绪时按 startWorkspace 重新决定初始视图（用户已手动切换则不动）
  useEffect(() => {
    if (!ready || viewTouched) return;
    const home = settings.startWorkspace === 'home' || (settings.startWorkspace === 'last' && localStorage.getItem(LAST_VIEW_KEY) === 'home');
    setViewRaw(home ? 'home' : 'workspace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  const [picked, setPicked] = useState<string | undefined>();

  const workspaceId = picked ?? (settings.startWorkspace === 'last' || settings.startWorkspace === 'home' ? settings.lastWorkspaceId : settings.startWorkspace);
  const selectWorkspace = useCallback(
    (id: string) => {
      setPicked(id);
      setView('workspace');
      setQuery('');
      void updateSettings({ lastWorkspaceId: id });
    },
    [updateSettings],
  );
  const toggleSelect = useCallback((id: string, on?: boolean) => {
    setSelection((s) => {
      const n = new Set(s);
      if (on ?? !n.has(id)) n.add(id);
      else n.delete(id);
      return n;
    });
  }, []);
  const clearSelection = useCallback(() => setSelection(new Set()), []);
  const setOrganize = useCallback((v: boolean) => {
    setOrganizeRaw(v);
    if (!v) setSelection(new Set());
  }, []);

  return (
    <Ctx.Provider
      value={{
        settings, updateSettings, ready, modes, mode, visibility, organize, setOrganize, selection, toggleSelect,
        clearSelection, query, setQuery, view, setView, workspaceId, selectWorkspace,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
