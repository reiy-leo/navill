import { Popover, Tooltip } from '@cloudflare/kumo';
import { useRef, useState, type ReactNode } from 'react';
import { COLOR_GROUPS, tone, useDarkMode, useTone } from './colors';

/** 颜色方块：整个方块就是按钮，点击弹出颜色选择（抽屉弹窗用） */
export function ColorSwatch({ color, onColor, label = '颜色', size = 36 }: { color?: string; onColor: (hex: string) => void; label?: string; size?: number }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLButtonElement>(null);
  const shown = useTone(color) ?? '#8d8d86';
  return (
    <>
      <Tooltip content={label} asChild>
        <button
          ref={box} type="button" aria-label={label}
          className="shrink-0 rounded-md transition-transform hover:scale-105"
          style={{ width: size, height: size, background: shown }}
          onClick={() => setOpen(true)}
        />
      </Tooltip>
      <Popover open={open} onOpenChange={setOpen}>
        <Popover.Content anchor={box} side="right" align="start" sideOffset={8} className="w-[37rem] max-w-[90vw] p-3">
          <ColorPicker label={label} value={color} onChange={(hex) => { onColor(hex); setOpen(false); }} />
        </Popover.Content>
      </Popover>
    </>
  );
}

/** 图标框：右上角颜色小圆点，点击弹出颜色选择 */
export function IconBox({ color, onColor, children, label = '颜色' }: { color?: string; onColor: (hex: string) => void; children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const dot = useRef<HTMLButtonElement>(null);
  const shown = useTone(color) ?? '#8d8d86';
  return (
    <span className="relative inline-flex shrink-0">
      {children}
      <Tooltip content={label} asChild>
        <button
          ref={dot} type="button" aria-label={label}
          className="absolute -top-1 -right-1 size-3.5 rounded-full ring-2 ring-kumo-base transition-transform hover:scale-125"
          style={{ background: shown }}
          onClick={() => setOpen(true)}
        />
      </Tooltip>
      <Popover open={open} onOpenChange={setOpen}>
        <Popover.Content anchor={dot} side="right" align="start" sideOffset={8} className="w-[37rem] max-w-[90vw] p-3">
          <ColorPicker label={label} value={color} onChange={(hex) => { onColor(hex); setOpen(false); }} />
        </Popover.Content>
      </Popover>
    </span>
  );
}

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
