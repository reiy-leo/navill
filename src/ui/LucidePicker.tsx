import { useTone } from './colors';
import { Button, Input } from '@cloudflare/kumo';
import { DynamicIcon, iconNames, type IconName } from 'lucide-react/dynamic';
import { useMemo, useState } from 'react';

import { tr } from '@/src/i18n';
/** 没输入关键词时显示的常用图标 */
const COMMON: IconName[] = [
  'folder', 'briefcase', 'house', 'target', 'book-open', 'brain', 'lightbulb', 'wrench', 'flask-conical', 'palette',
  'music', 'gamepad-2', 'camera', 'plane', 'utensils', 'wallet', 'trending-up', 'file-text', 'bookmark', 'star',
  'flame', 'sprout', 'dumbbell', 'clapperboard', 'tv', 'shopping-cart', 'receipt', 'lock', 'bot', 'laptop',
  'globe', 'newspaper', 'calendar', 'heart', 'cat', 'moon', 'sun', 'rocket', 'code', 'graduation-cap',
  'users', 'mail', 'map', 'cloud', 'database', 'server', 'shield', 'zap', 'gift', 'coffee',
].filter((n) => (iconNames as string[]).includes(n)) as IconName[];

const LIMIT = 80;

/** Lucide 图标选择：关键词按图标英文名匹配；allowNone 时再点一次已选图标即取消（回到名称首字） */
export function LucidePicker({ value, onChange, allowNone = true, color }: { value?: string; onChange: (name: string | undefined) => void; allowNone?: boolean; color?: string }) {
  const [q, setQ] = useState('');
  const c = useTone(color);
  const list = useMemo(() => {
    const k = q.trim().toLowerCase().replace(/\s+/g, '-');
    if (!k) return COMMON;
    return iconNames.filter((n) => n.includes(k)).slice(0, LIMIT);
  }, [q]);
  return (
    <div className="grid gap-2">
      <Input size="sm" placeholder={tr('搜索图标，如 book、code、home')} aria-label={tr('搜索图标')} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex max-h-48 flex-wrap gap-1 overflow-y-auto">
        {list.map((n) => (
          <Button
            key={n} size="sm" shape="square" title={n} aria-label={n}
            variant={value === n && !c ? 'outline' : 'ghost'}
            className={value === n ? (c ? 'nv-pick-on' : '!ring-kumo-brand') : c ? 'nv-pick' : ''}
            style={c ? ({ '--pick': c } as React.CSSProperties) : undefined}
            onClick={() => onChange(allowNone && value === n ? undefined : n)}>
            <DynamicIcon name={n} size={18} />
          </Button>
        ))}
        {list.length === 0 && <span className="px-2 py-1 text-sm text-kumo-subtle">{tr('没有匹配的图标')}</span>}
      </div>
    </div>
  );
}
