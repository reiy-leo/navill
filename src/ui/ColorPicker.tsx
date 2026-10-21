import { Button, Popover, Tooltip } from '@cloudflare/kumo';
import { Link2 } from 'lucide-react';
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { COLOR_COLUMNS, presetOf, pushRecentColor, recentColors, tone, useDarkMode, useTone } from './colors';

import { tr } from '@/src/i18n';
/** 颜色方块：整个方块就是按钮，点击弹出颜色选择（抽屉弹窗用） */
export function ColorSwatch({ color, onColor, label = tr('颜色'), size = 36 }: { color?: string; onColor: (hex: string) => void; label?: string; size?: number }) {
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
        <Popover.Content anchor={box} side="right" align="start" sideOffset={8} className="max-w-[90vw] p-3">
          <ColorPicker label={label} value={color} onChange={(hex) => { onColor(hex); setOpen(false); }} />
        </Popover.Content>
      </Popover>
    </>
  );
}

/** 图标框：右上角颜色小圆点，点击弹出颜色选择 */
export function IconBox({ color, onColor, children, label = tr('颜色') }: { color?: string; onColor: (hex: string) => void; children: ReactNode; label?: string }) {
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
        <Popover.Content anchor={dot} side="right" align="start" sideOffset={8} className="max-w-[90vw] p-3">
          <ColorPicker label={label} value={color} onChange={(hex) => { onColor(hex); setOpen(false); }} />
        </Popover.Content>
      </Popover>
    </span>
  );
}

/** 统一的颜色选择：色板 8×7 圆角方块，每列一个色相、由浅到深，同色系一眼找到；顶部一行最近使用（不加文字，下方一条浅分隔线；最右可放图标按钮，如「跟随工作区」）；悬停显示名称 */
export function ColorPicker({ value, onChange, label = tr('颜色'), extra }: { value?: string; onChange: (hex: string) => void; label?: string; extra?: ReactNode }) {
  const dark = useDarkMode();
  const cur = value?.toLowerCase();
  const [recent] = useState(recentColors);
  const pick = (hex: string) => { pushRecentColor(hex); onChange(hex); };
  const dot = (hex: string, name: string) => {
    const on = cur === hex.toLowerCase();
    const shown = tone(hex, dark)!;
    return (
      <Tooltip key={hex} content={name} asChild>
        <button
          type="button" role="radio" aria-checked={on} aria-label={name}
          className={`size-[17px] shrink-0 rounded-[4px] ring-offset-1 ring-offset-kumo-base transition-transform hover:scale-110 ${on ? 'ring-[1.5px]' : ''}`}
          style={{ background: shown, ['--tw-ring-color' as string]: `color-mix(in oklab, ${shown} 75%, var(--text-color-kumo-default, #000))` }}
          onClick={() => pick(hex)}
        />
      </Tooltip>
    );
  };
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2.5">
      {(recent.length > 0 || extra) && (
        <>
          <div className="flex min-h-6 items-center gap-1.5">
            {recent.map((hex) => dot(hex, presetOf(hex)?.name ?? hex))}
            {extra && <span className="ml-auto pl-3">{extra}</span>}
          </div>
          <hr className="border-kumo-line opacity-60" />
        </>
      )}
      <div className="grid grid-flow-col grid-rows-7 gap-1.5">
        {COLOR_COLUMNS.flat().map((c) => dot(c.light, c.name))}
      </div>
    </div>
  );
}

/** 抽屉菜单「指定颜色」：锚在触发按钮旁的浮层，点色立即生效；「跟随工作区」清除抽屉自己的颜色；点外面或 Esc 关闭 */
export function DrawerColorPopover({ anchor, open, onOpenChange, value, onChange, follow }: {
  anchor: RefObject<HTMLElement | null>; open: boolean; onOpenChange: (o: boolean) => void;
  value?: string; onChange: (hex: string | undefined) => void; follow?: string;
}) {
  const followShown = useTone(follow) ?? '#8d8d86';
  const followTip = (
    <span className="flex items-center gap-1.5">
      <span className="size-3 rounded-[3px]" style={{ background: followShown }} />
      {tr('跟随工作区')}{follow ? ` · ${presetOf(follow)?.name ?? follow}` : ''}
    </span>
  );
  const set = (hex: string | undefined) => { onChange(hex); onOpenChange(false); };
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Popover.Content anchor={anchor} side="bottom" align="end" sideOffset={6} className="max-w-[90vw] p-3">
        <ColorPicker label={tr('抽屉颜色')} value={value} onChange={(hex) => set(hex)}
          extra={
            <Tooltip content={followTip} asChild>
              <Button size="sm" shape="square" variant="ghost" icon={Link2} aria-label={tr('跟随工作区')} disabled={!value} onClick={() => set(undefined)} />
            </Tooltip>
          } />
      </Popover.Content>
    </Popover>
  );
}
