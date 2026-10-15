import { Button, DropdownMenu, Tooltip } from '@cloudflare/kumo';
import { Check, Columns, GridFour, Kanban, Rows, SortAscending, SquaresFour, Layout } from '@phosphor-icons/react';
import type { SortMode, ViewMode } from '@/src/db';
import type { Arrange } from '@/src/lib/settings';

export const VIEW_LABEL: Record<ViewMode, string> = { icon: '图标', row: '行', tile: '平铺', bento: 'Bento' };
const VIEW_ICON = { icon: SquaresFour, row: Rows, tile: GridFour, bento: Layout } as const;
export const SORT_LABEL: Record<SortMode, string> = {
  smart: '智能', manual: '手动', 'name-asc': '名称升序', 'name-desc': '名称降序', 'clicks-asc': '点击次数升序', 'clicks-desc': '点击次数降序',
};

export function ViewMenu({ value, inherited, onChange }: { value: ViewMode; inherited?: boolean; onChange: (v: ViewMode | null) => void }) {
  const Icon = VIEW_ICON[value];
  return (
    <DropdownMenu>
      <Tooltip content={`视图：${VIEW_LABEL[value]}${inherited ? ' · 跟随工作区' : ''}`} side="bottom">
        <DropdownMenu.Trigger render={<Button variant="ghost" size="xs" shape="square" icon={<Icon />} aria-label={`视图：${VIEW_LABEL[value]}`} />} />
      </Tooltip>
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
      <Tooltip content={`排序：${SORT_LABEL[value]}`} side="bottom">
        <DropdownMenu.Trigger render={<Button variant="ghost" size="xs" shape="square" icon={<SortAscending />} aria-label={`排序：${SORT_LABEL[value]}`} />} />
      </Tooltip>
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

export const ARRANGE_LABEL: Record<Arrange, string> = { strip: '横条', masonry: '瀑布', bento: '便当', board: '看板' };
const ARRANGE_ICON = { strip: Rows, masonry: Columns, bento: Layout, board: Kanban } as const;

/** 工作区标题栏的「排列」按钮：切换抽屉排列方式 */
export function ArrangeMenu({ value, onChange }: { value: Arrange; onChange: (v: Arrange) => void }) {
  const Icon = ARRANGE_ICON[value];
  return (
    <DropdownMenu>
      <Tooltip content={`排列：${ARRANGE_LABEL[value]}`} side="bottom">
        <DropdownMenu.Trigger render={<Button variant="ghost" size="xs" shape="square" icon={<Icon />} aria-label={`排列：${ARRANGE_LABEL[value]}`} />} />
      </Tooltip>
      <DropdownMenu.Content>
        {(Object.keys(ARRANGE_LABEL) as Arrange[]).map((v) => (
          <DropdownMenu.Item key={v} icon={ARRANGE_ICON[v]} onClick={() => onChange(v)}>
            {ARRANGE_LABEL[v]} {value === v ? '✓' : ''}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
