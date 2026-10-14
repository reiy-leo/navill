import { iconCount } from '@/src/lib/emoji';
import type { Workspace } from '@/src/db';
import { faviconUrl } from '@/src/lib/favicon';
import { useState } from 'react';

export function BookmarkIcon({ url, size = 16, src }: { url: string; size?: number; src?: string }) {
  const [failed, setFailed] = useState(false);
  let letter = '•';
  try {
    letter = new URL(url).hostname.replace(/^www\./, '').charAt(0).toUpperCase() || '•';
  } catch { /* 非标准 URL */ }
  if (failed) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded bg-kumo-tint text-kumo-subtle"
        style={{ width: size, height: size, fontSize: size * 0.6 }}
      >
        {letter}
      </span>
    );
  }
  return (
    <img
      src={src || faviconUrl(url, size > 24 ? 64 : 32)}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-sm"
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}

export function WorkspaceIcon({ ws, size = 24 }: { ws: Pick<Workspace, 'name' | 'emoji' | 'color'>; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-md font-semibold text-white"
      style={{
        width: size, height: size, fontSize: ws.emoji ? size * (iconCount(ws.emoji) > 1 ? 0.42 : 0.7) : size * 0.5,
        letterSpacing: ws.emoji ? '-0.05em' : undefined,
        background: ws.emoji ? 'transparent' : ws.color ?? '#8d8d86',
      }}
    >
      {ws.emoji || ws.name.trim().charAt(0) || '?'}
    </span>
  );
}

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
