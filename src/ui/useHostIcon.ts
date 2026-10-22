import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo } from 'react';
import { db } from '@/src/db';
import { hostKey, isFresh, requestIcon } from '@/src/lib/icons/fetcher';

/**
 * 同一域名的图标在整页共用一个 objectURL：多个书签同域名时不重复解码，
 * 实时查询重跑（返回新对象）也不会换新 URL 导致图片重新加载。图标更新后旧 URL 稍后释放。
 */
const urls = new Map<string, { v: number; url: string }>();
function urlFor(host: string, v: number, blob: Blob): string {
  const c = urls.get(host);
  if (c && c.v === v) return c.url;
  const url = URL.createObjectURL(blob);
  if (c) setTimeout(() => URL.revokeObjectURL(c.url), 10_000);
  urls.set(host, { v, url });
  return url;
}

/** 返回该网址域名的高清图标 objectURL；还没有时触发后台抓取并返回 undefined */
export function useHostIcon(url: string, enabled = true): string | undefined {
  const host = enabled ? hostKey(url) : null;
  const entry = useLiveQuery(() => (host ? db.icons.get(host) : undefined), [host]);
  const ver = entry?.blob ? entry.fetchedAt : undefined;
  const src = useMemo(() => (host && entry?.blob ? urlFor(host, entry.fetchedAt, entry.blob) : undefined), [host, ver]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!host) return;
    let cancelled = false;
    void db.icons.get(host).then((c) => { if (!cancelled && !isFresh(c)) requestIcon(db, host); });
    return () => { cancelled = true; };
  }, [host]);
  return src;
}
