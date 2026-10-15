import { Tooltip } from '@cloudflare/kumo';
import { COLOR_GROUPS, tone, useDarkMode } from './colors';

/** 统一的颜色选择：64 种预置色按类分行，色块按当前主题显示，悬停显示名称 */
export function ColorPicker({ value, onChange, label = '颜色' }: { value?: string; onChange: (hex: string) => void; label?: string }) {
  const dark = useDarkMode();
  const cur = value?.toLowerCase();
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-x-6 gap-y-1.5">
      {COLOR_GROUPS.map((g) => (
        <div key={g.name} className="flex items-center gap-2">
          <span className="w-8 shrink-0 text-xs text-kumo-subtle">{g.name}</span>
          <div className="flex gap-1.5">
            {g.colors.map((c) => {
              const on = cur === c.light;
              const shown = tone(c.light, dark)!;
              return (
                <Tooltip key={c.light} content={c.name} asChild>
                  <button
                    type="button" role="radio" aria-checked={on} aria-label={c.name}
                    className={`size-6 shrink-0 rounded-full ring-offset-2 ring-offset-kumo-base transition-transform hover:scale-110 ${on ? 'ring-2' : ''}`}
                    style={{ background: shown, ['--tw-ring-color' as string]: shown }}
                    onClick={() => onChange(c.light)}
                  />
                </Tooltip>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
