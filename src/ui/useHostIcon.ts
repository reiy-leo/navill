import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo } from 'react';
import { db } from '@/src/db';
import { hostKey, isFresh, requestIcon } from '@/src/lib/icons/fetcher';

/** 返回该网址域名的高清图标 objectURL；还没有时触发后台抓取并返回 undefined */
export function useHostIcon(url: string, enabled = true): string | undefined {
  const host = enabled ? hostKey(url) : null;
  const entry = useLiveQuery(() => (host ? db.icons.get(host) : undefined), [host]);
  const src = useMemo(() => (entry?.blob ? URL.createObjectURL(entry.blob) : undefined), [entry]);
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);
  useEffect(() => {
    if (!host) return;
    let cancelled = false;
    void db.icons.get(host).then((c) => { if (!cancelled && !isFresh(c)) requestIcon(db, host); });
    return () => { cancelled = true; };
  }, [host]);
  return src;
}
