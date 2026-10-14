import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { MODE_DEFAULT, db, type Mode } from '@/src/db';
import type { Settings } from '@/src/lib/settings';
import { visibilityOf, type Visibility } from '@/src/lib/view';
import { useSettings } from './useSettings';

export type MainView = 'workspace' | 'archive';

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
  const [view, setView] = useState<MainView>('workspace');
  const [picked, setPicked] = useState<string | undefined>();

  const workspaceId = picked ?? (settings.startWorkspace === 'last' ? settings.lastWorkspaceId : settings.startWorkspace);
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
