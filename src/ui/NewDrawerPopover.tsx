import { Button, Input, Popover } from '@cloudflare/kumo';
import { useState, type RefObject } from 'react';
import { ColorSwatch } from './ColorPicker';
import { tr } from '@/src/i18n';

/** 新建抽屉：在按钮旁弹出的小浮层，只有颜色和名称；回车或「添加」创建 */
export function NewDrawerPopover({ anchor, open, onOpenChange, color: initColor, onCreate }: {
  anchor: RefObject<HTMLElement | null>; open: boolean; onOpenChange: (o: boolean) => void; color: string;
  onCreate: (name: string, color: string) => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(initColor);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) { setWasOpen(open); if (open) { setName(''); setColor(initColor); } }
  const ok = () => { onOpenChange(false); onCreate(name, color); };
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Popover.Content anchor={anchor} side="bottom" align="end" sideOffset={6} className="w-72 max-w-[90vw] p-2">
        <div className="flex items-center gap-1.5">
          <ColorSwatch color={color} onColor={setColor} label={tr('抽屉颜色')} size={26} />
          <Input autoFocus size="sm" className="min-w-0 flex-1" value={name} placeholder={tr('{0}名称', tr('抽屉'))} aria-label={tr('{0}名称', tr('抽屉'))}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && ok()} />
          <Button variant="primary" size="sm" onClick={ok}>{tr('添加')}</Button>
        </div>
      </Popover.Content>
    </Popover>
  );
}
