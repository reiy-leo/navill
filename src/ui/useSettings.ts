import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, getSettings, settingsItem, syncStatusItem, updateSettings, type Settings, type SyncStatus } from '@/src/lib/settings';

export function useSettings(): [Settings, (patch: Partial<Settings>) => Promise<Settings>, boolean] {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void getSettings().then((v) => {
      setS(v);
      setReady(true);
    });
    // 内容没变（如别的标签页写入同样的值）就保留旧对象，避免整棵树重渲染
    return settingsItem.watch(() => void getSettings().then((v) => setS((prev) => (JSON.stringify(prev) === JSON.stringify(v) ? prev : v))));
  }, []);
  return [s, updateSettings, ready];
}

export function useSyncStatus(): SyncStatus {
  const [s, setS] = useState<SyncStatus>({ state: 'signed-out' });
  useEffect(() => {
    void syncStatusItem.getValue().then(setS);
    return syncStatusItem.watch((v) => setS(v ?? { state: 'signed-out' }));
  }, []);
  return s;
}
