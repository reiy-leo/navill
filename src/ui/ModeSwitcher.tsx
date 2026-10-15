import { Tooltip } from '@cloudflare/kumo';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import { MODE_DEFAULT, PALETTE, type Mode } from '@/src/db';
import { useApp } from './state';

const PRESET: Record<string, { icon: IconName; color: string }> = {
  [MODE_DEFAULT]: { icon: 'layers', color: PALETTE[9]! },
  'mode-work': { icon: 'briefcase', color: PALETTE[4]! },
  'mode-home': { icon: 'house', color: PALETTE[7]! },
  'mode-talk': { icon: 'presentation', color: PALETTE[0]! },
  'mode-lend': { icon: 'hand-helping', color: PALETTE[3]! },
};

/** 场景的颜色与图标：自己设过的优先，其次预设，最后按顺序取色 */
export function modeLook(m: Mode): { icon: IconName; color: string } {
  const p = PRESET[m.id];
  return { icon: (m.icon ?? p?.icon ?? 'circle-dot') as IconName, color: m.color ?? p?.color ?? PALETTE[Math.abs(m.order) % PALETTE.length]! };
}

export function ModeIcon({ mode, size = 16 }: { mode: Mode; size?: number }) {
  const { icon, color } = modeLook(mode);
  return <DynamicIcon name={icon} size={size} color={color} />;
}

/** 场景切换：分段单选，只显示图标，悬停显示名称。⋯ 菜单与弹窗共用 */
export function ModeSwitcher({ side = 'bottom' }: { side?: 'top' | 'bottom' }) {
  const { modes, mode, updateSettings } = useApp();
  return (
    <div role="radiogroup" aria-label="场景" className="nv-seg inline-flex gap-0.5 rounded-lg bg-kumo-tint/70 p-0.5">
      {modes.map((m) => {
        const on = m.id === mode?.id;
        const { icon, color } = modeLook(m);
        return (
          <Tooltip key={m.id} content={m.showAdult ? `${m.name} · 18+` : m.name} side={side}>
            <button
              type="button" role="radio" aria-checked={on} aria-label={m.name}
              className={`grid size-7 place-items-center rounded-md transition-colors ${on ? 'shadow-sm' : 'opacity-55 hover:opacity-100'}`}
              style={{ color, background: on ? `color-mix(in srgb, ${color} 18%, var(--color-kumo-base, #fff))` : undefined }}
              onClick={() => void updateSettings({ currentModeId: m.id })}
            >
              <DynamicIcon name={icon} size={16} />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
