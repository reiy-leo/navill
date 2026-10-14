import { Button, DropdownMenu } from '@cloudflare/kumo';
import { Check, GridFour, Rows, SortAscending, SquaresFour, Layout } from '@phosphor-icons/react';
import type { SortMode, ViewMode } from '@/src/db';

export const VIEW_LABEL: Record<ViewMode, string> = { icon: '图标', row: '行', tile: '平铺', bento: 'Bento' };
const VIEW_ICON = { icon: SquaresFour, row: Rows, tile: GridFour, bento: Layout } as const;
export const SORT_LABEL: Record<SortMode, string> = {
  manual: '手动', 'name-asc': '名称升序', 'name-desc': '名称降序', 'clicks-asc': '点击次数升序', 'clicks-desc': '点击次数降序',
};

export function ViewMenu({ value, inherited, onChange }: { value: ViewMode; inherited?: boolean; onChange: (v: ViewMode | null) => void }) {
  const Icon = VIEW_ICON[value];
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger render={<Button variant="ghost" size="xs" shape="square" icon={<Icon />} aria-label={`视图：${VIEW_LABEL[value]}`} title={`视图：${VIEW_LABEL[value]}${inherited ? '（跟随工作区）' : ''}`} />} />
      <DropdownMenu.Content>
        {(Object.keys(VIEW_LABEL) as ViewMode[]).map((v) => (
          <DropdownMenu.Item key={v} icon={VIEW_ICON[v]} onClick={() => onChange(v)}>
            {VIEW_LABEL[v]} {value === v && !inherited ? '✓' : ''}
          </DropdownMenu.Item>
        ))}
        {inherited !== undefined && (
          <DropdownMenu.Item icon={inherited ? Check : undefined} onClick={() => onChange(null)}>
            跟随工作区
          </DropdownMenu.Item>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

export function SortMenu({ value, onChange }: { value: SortMode; onChange: (v: SortMode) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger render={<Button variant="ghost" size="xs" shape="square" icon={<SortAscending />} aria-label={`排序：${SORT_LABEL[value]}`} title={`排序：${SORT_LABEL[value]}`} />} />
      <DropdownMenu.Content>
        {(Object.keys(SORT_LABEL) as SortMode[]).map((v) => (
          <DropdownMenu.Item key={v} onClick={() => onChange(v)}>
            {SORT_LABEL[v]} {value === v ? '✓' : ''}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
