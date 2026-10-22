import { Popover } from '@cloudflare/kumo';
import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

import { tr } from '@/src/i18n';
/** 说明性文字收进 ⓘ 图标：悬停或点击显示，不占版面 */
export function InfoTip({ children, label = tr('说明'), text }: { children: ReactNode; label?: string; /** 图标旁显示的短文字，如「说明」 */ text?: string }) {
  return (
    <Popover>
      <Popover.Trigger
        openOnHover
        delay={150}
        aria-label={label}
        className={`inline-flex h-5 shrink-0 cursor-help items-center justify-center gap-1 rounded-full text-sm text-kumo-subtle opacity-50 transition-opacity hover:text-kumo-default hover:opacity-100 data-[popup-open]:text-kumo-default data-[popup-open]:opacity-100 ${text ? 'px-1' : 'w-5'}`}
      >
        <Info size={14} />{text}
      </Popover.Trigger>
      <Popover.Content side="top" sideOffset={6} className="max-w-72 px-3 py-2 text-sm leading-relaxed">
        {children}
      </Popover.Content>
    </Popover>
  );
}
