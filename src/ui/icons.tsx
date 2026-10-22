import { inkOn, useTone } from './colors';
import { iconToneOf, measureIconTone, type IconTone } from '@/src/lib/icons/tone';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import { useIconStyle } from './iconStyle';
import { iconCount, iconParts } from '@/src/lib/emoji';
import type { Workspace } from '@/src/db';
import { faviconUrl } from '@/src/lib/favicon';
import { useState } from 'react';
import { useHostIcon } from './useHostIcon';

/** 几乎全白/全黑的透明图标：在同色主题下反转（见 app.css .nv-ico-*） */
const toneClass = (t: IconTone | undefined) => (t === 'light' ? 'nv-ico-light' : t === 'dark' ? 'nv-ico-dark' : '');

export function BookmarkIcon({ url, size = 16, src }: { url: string; size?: number; src?: string }) {
  const [failed, setFailed] = useState(false);
  const [tone, setTone] = useState<IconTone | undefined>();
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
  const imgSrc = src || hd || faviconUrl(url, size > 24 ? 64 : 32);
  return (
    <img
      src={imgSrc}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-sm ${toneClass(tone ?? iconToneOf(imgSrc))}`}
      onLoad={(e) => setTone(measureIconTone(e.currentTarget))}
      onError={() => setFailed(true)}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}

/** 两个 emoji / 字符紧贴显示：第二个用负外边距往前靠 */
const tight = (parts: string[], overlap: string) =>
  parts.length < 2 ? parts.join('') : parts.map((p, i) => <span key={i} style={i ? { marginLeft: overlap } : undefined}>{p}</span>);

/** 字符图标：用户输入的字符，否则名称首字 */
export const charIcon = (ws: { name: string; glyph?: string }) => Array.from(ws.glyph?.trim() ?? '').slice(0, 2).join('') || Array.from(ws.name.trim())[0] || '?';

/** 线性图标模式下工作区没设线性图标：按 emoji 选一个相近的，选不到用文件夹，不退回字符 */
const EMOJI_LUCIDE: Record<string, string> = {
  '📥': 'inbox', '📚': 'library', '📖': 'book-open', '💼': 'briefcase', '📎': 'paperclip', '👨‍💻': 'laptop', '💻': 'laptop',
  '🎮': 'gamepad-2', '🕹️': 'joystick', '👾': 'gamepad-2', '⭐': 'star', '🌟': 'star', '❤️': 'heart', '🏠': 'house', '🏡': 'house',
  '🎵': 'music', '🎶': 'music', '🎬': 'clapperboard', '📺': 'tv', '📷': 'camera', '🎨': 'palette', '✈️': 'plane', '🌍': 'globe',
  '🌐': 'globe', '🛒': 'shopping-cart', '🛍️': 'shopping-bag', '💰': 'wallet', '💵': 'banknote', '📈': 'trending-up', '📊': 'chart-bar',
  '📰': 'newspaper', '📝': 'notebook-pen', '✏️': 'pencil', '🔧': 'wrench', '🛠️': 'hammer', '⚙️': 'settings', '🔬': 'microscope',
  '🧪': 'flask-conical', '🤖': 'bot', '🧠': 'brain', '🍔': 'utensils', '🍳': 'chef-hat', '☕': 'coffee', '🏃': 'activity',
  '💪': 'dumbbell', '🏥': 'hospital', '💊': 'pill', '🎓': 'graduation-cap', '🏫': 'school', '📅': 'calendar', '🗂️': 'folder-open',
  '📁': 'folder', '📂': 'folder-open', '🔖': 'bookmark', '🔗': 'link', '🔒': 'lock', '🔑': 'key', '🚀': 'rocket', '💡': 'lightbulb',
  '🐱': 'cat', '🐶': 'dog', '🌱': 'sprout', '🎁': 'gift', '📦': 'package', '🧳': 'luggage', '🚗': 'car', '📱': 'smartphone',
};
function lucideFromEmoji(emoji?: string): string {
  for (const part of emoji ? iconParts(emoji) : []) {
    const hit = EMOJI_LUCIDE[part] ?? EMOJI_LUCIDE[part.replace(/\uFE0F/g, '')];
    if (hit) return hit;
  }
  return 'folder';
}

export function WorkspaceIcon({ ws, size = 24, style }: { ws: Pick<Workspace, 'name' | 'emoji' | 'lucide' | 'color'> & { glyph?: string }; size?: number; style?: 'emoji' | 'lucide' | 'char' }) {
  const global = useIconStyle();
  const mode = style ?? global;
  const bg = useTone(ws.color) ?? '#8d8d86';
  const lucide = mode === 'lucide' ? ws.lucide || lucideFromEmoji(ws.emoji) : undefined;
  if (lucide) {
    return (
      <span className="inline-flex shrink-0 items-center justify-center rounded-md" style={{ width: size, height: size, background: bg, color: inkOn(bg) }}>
        <DynamicIcon name={lucide as IconName} size={Math.round(size * 0.6)} strokeWidth={2} />
      </span>
    );
  }
  const emoji = mode === 'emoji' ? ws.emoji : undefined;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-md font-semibold"
      style={{
        width: size, height: size, fontSize: emoji ? size * (iconCount(emoji) > 1 ? 0.46 : 0.7) : size * (Array.from(charIcon(ws)).length > 1 ? 0.36 : 0.5),
        background: emoji ? 'transparent' : bg,
        color: emoji ? undefined : inkOn(bg),
      }}
    >
      {tight(emoji ? iconParts(emoji) : Array.from(charIcon(ws)), emoji ? '-0.16em' : '-0.08em')}
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
