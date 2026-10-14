import { Button, DropdownMenu } from '@cloudflare/kumo';
import { Check, Stack } from '@phosphor-icons/react';
import { useApp } from './state';

/** 场景切换器：新标签页顶栏与弹窗共用 */
export function ModeSwitcher({ size = 'sm' }: { size?: 'xs' | 'sm' }) {
  const { modes, mode, updateSettings } = useApp();
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger render={<Button size={size} variant="ghost" icon={<Stack />} title="切换场景">{mode?.name ?? '默认'}</Button>} />
      <DropdownMenu.Content>
        {modes.map((m) => (
          <DropdownMenu.Item key={m.id} icon={m.id === mode?.id ? Check : undefined} inset={m.id !== mode?.id} onClick={() => void updateSettings({ currentModeId: m.id })}>
            {m.name}
            {m.showAdult ? ' · 18+' : ''}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
