import { Popover } from '@cloudflare/kumo';
import { Info } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

/** 说明性文字收进 ⓘ 图标：悬停或点击显示，不占版面 */
export function InfoTip({ children, label = '说明', text }: { children: ReactNode; label?: string; /** 图标旁显示的短文字，如「说明」 */ text?: string }) {
  return (
    <Popover>
      <Popover.Trigger
        openOnHover
        delay={150}
        aria-label={label}
        className={`inline-flex h-6 shrink-0 cursor-help items-center justify-center gap-1 rounded-full text-sm text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default ${text ? 'px-1.5' : 'w-6'}`}
      >
        <Info size={18} />{text}
      </Popover.Trigger>
      <Popover.Content side="top" sideOffset={6} className="max-w-72 px-3 py-2 text-sm leading-relaxed">
        {children}
      </Popover.Content>
    </Popover>
  );
}
