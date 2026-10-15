import { useTone } from './colors';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import { useIconStyle } from './iconStyle';
import { iconCount } from '@/src/lib/emoji';
import type { Workspace } from '@/src/db';
import { faviconUrl } from '@/src/lib/favicon';
import { useState } from 'react';
import { useHostIcon } from './useHostIcon';

export function BookmarkIcon({ url, size = 16, src }: { url: string; size?: number; src?: string }) {
  const [failed, setFailed] = useState(false);
  const hd = useHostIcon(url, !src);
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
      src={src || hd || faviconUrl(url, size > 24 ? 64 : 32)}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-sm"
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}

export function WorkspaceIcon({ ws, size = 24, style }: { ws: Pick<Workspace, 'name' | 'emoji' | 'lucide' | 'color'>; size?: number; style?: 'emoji' | 'lucide' }) {
  const global = useIconStyle();
  const mode = style ?? global;
  const bg = useTone(ws.color) ?? '#8d8d86';
  if (mode === 'lucide' && ws.lucide) {
    return (
      <span className="inline-flex shrink-0 items-center justify-center rounded-md text-white" style={{ width: size, height: size, background: bg }}>
        <DynamicIcon name={ws.lucide as IconName} size={Math.round(size * 0.6)} strokeWidth={2} />
      </span>
    );
  }
  const emoji = mode === 'emoji' ? ws.emoji : undefined;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-md font-semibold text-white"
      style={{
        width: size, height: size, fontSize: emoji ? size * (iconCount(emoji) > 1 ? 0.42 : 0.7) : size * 0.5,
        letterSpacing: emoji ? '-0.05em' : undefined,
        background: emoji ? 'transparent' : bg,
      }}
    >
      {emoji || ws.name.trim().charAt(0) || '?'}
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
