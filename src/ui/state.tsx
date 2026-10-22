import { useLiveQuery } from 'dexie-react-hooks';
import { localizeNames } from '@/src/lib/presetNames';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MODE_DEFAULT, db, type Mode } from '@/src/db';
import type { Settings } from '@/src/lib/settings';
import { visibilityOf, type Visibility } from '@/src/lib/view';
import { useSettings } from './useSettings';

const LAST_VIEW_KEY = 'navill-last-view';

export type MainView = 'home' | 'workspace';
/** 右侧抽屉里打开的管理面板 */
export type Panel = 'archive' | 'shares' | 'market' | 'aliases';

interface AppState {
  settings: Settings;
  updateSettings: (p: Partial<Settings>) => Promise<Settings>;
  ready: boolean;
  modes: Mode[];
  mode: Mode | undefined;
  visibility: Visibility;
  view: MainView;
  setView: (v: MainView) => void;
  panel: Panel | null;
  setPanel: (p: Panel | null) => void;
  workspaceId: string | undefined;
  selectWorkspace: (id: string) => void;
}

/** 整理模式与多选：变化频繁，单独一个 context，只有用到的组件才重渲染 */
interface SelectionState {
  organize: boolean;
  setOrganize: (v: boolean) => void;
  selection: Set<string>; // placement ids
  toggleSelect: (placementId: string, on?: boolean) => void;
  clearSelection: () => void;
}
/** 搜索词：每次按键都变，单独一个 context */
interface QueryState { query: string; setQuery: (q: string) => void }

const Ctx = createContext<AppState | null>(null);
const SelCtx = createContext<SelectionState | null>(null);
const QueryCtx = createContext<QueryState | null>(null);
export const useApp = () => useContext(Ctx)!;
export const useSelection = () => useContext(SelCtx)!;
export const useQuery = () => useContext(QueryCtx)!;
const NO_MODES: Mode[] = [];

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [settings, updateSettings, ready] = useSettings();
  const modes = useLiveQuery(async () => localizeNames(await db.modes.orderBy('order').toArray()), []) ?? NO_MODES;
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
    localStorage.setItem(LAST_VIEW_KEY, v);
  }, []);
  // 设置异步载入：首次就绪时按 startWorkspace 重新决定初始视图（用户已手动切换则不动）
  useEffect(() => {
    if (!ready || viewTouched) return;
    const home = settings.startWorkspace === 'home' || (settings.startWorkspace === 'last' && localStorage.getItem(LAST_VIEW_KEY) === 'home');
    setViewRaw(home ? 'home' : 'workspace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  const [picked, setPicked] = useState<string | undefined>();
  const [panel, setPanel] = useState<Panel | null>(null);

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

  const app = useMemo<AppState>(
    () => ({ settings, updateSettings, ready, modes, mode, visibility, view, setView, panel, setPanel, workspaceId, selectWorkspace }),
    [settings, updateSettings, ready, modes, mode, visibility, view, setView, panel, workspaceId, selectWorkspace],
  );
  const sel = useMemo<SelectionState>(
    () => ({ organize, setOrganize, selection, toggleSelect, clearSelection }),
    [organize, setOrganize, selection, toggleSelect, clearSelection],
  );
  const q = useMemo<QueryState>(() => ({ query, setQuery }), [query]);

  return (
    <Ctx.Provider value={app}>
      <SelCtx.Provider value={sel}>
        <QueryCtx.Provider value={q}>{children}</QueryCtx.Provider>
      </SelCtx.Provider>
    </Ctx.Provider>
  );
}
