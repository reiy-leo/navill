import { Button, DropdownMenu, Tooltip } from '@cloudflare/kumo';
import { Check, Columns, GridFour, Kanban, Rows, SortAscending, SquaresFour, Layout } from '@phosphor-icons/react';
import type { SortMode, ViewMode } from '@/src/db';
import type { Arrange } from '@/src/lib/settings';

import { tr } from '@/src/i18n';
export const VIEW_LABEL: Record<ViewMode, string> = { icon: tr('图标'), row: tr('行'), tile: tr('平铺'), bento: 'Bento' };
const VIEW_ICON = { icon: SquaresFour, row: Rows, tile: GridFour, bento: Layout } as const;
export const SORT_LABEL: Record<SortMode, string> = {
  smart: tr('智能'), manual: tr('手动'), 'name-asc': tr('名称升序'), 'name-desc': tr('名称降序'), 'clicks-asc': tr('点击次数升序'), 'clicks-desc': tr('点击次数降序'),
};

export function ViewMenu({ value, inherited, onChange }: { value: ViewMode; inherited?: boolean; onChange: (v: ViewMode | null) => void }) {
  const Icon = VIEW_ICON[value];
  return (
    <DropdownMenu>
      <Tooltip content={tr('视图：{0}{1}', VIEW_LABEL[value], inherited ? ' · 跟随工作区' : '')} side="bottom">
        <DropdownMenu.Trigger render={<Button variant="ghost" size="xs" shape="square" icon={<Icon />} aria-label={tr('视图：{0}', VIEW_LABEL[value])} />} />
      </Tooltip>
      <DropdownMenu.Content>
        {(Object.keys(VIEW_LABEL) as ViewMode[]).map((v) => (
          <DropdownMenu.Item key={v} icon={VIEW_ICON[v]} onClick={() => onChange(v)}>
            {VIEW_LABEL[v]} {value === v && !inherited ? '✓' : ''}
          </DropdownMenu.Item>
        ))}
        {inherited !== undefined && (
          <DropdownMenu.Item icon={inherited ? Check : undefined} onClick={() => onChange(null)}>
            {tr('跟随工作区')}
          </DropdownMenu.Item>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

export function SortMenu({ value, onChange }: { value: SortMode; onChange: (v: SortMode) => void }) {
  return (
    <DropdownMenu>
      <Tooltip content={tr('排序：{0}', SORT_LABEL[value])} side="bottom">
        <DropdownMenu.Trigger render={<Button variant="ghost" size="xs" shape="square" icon={<SortAscending />} aria-label={tr('排序：{0}', SORT_LABEL[value])} />} />
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

export const ARRANGE_LABEL: Record<Arrange, string> = { strip: tr('横条'), masonry: tr('瀑布'), bento: tr('便当'), board: tr('看板') };
const ARRANGE_ICON = { strip: Rows, masonry: Columns, bento: Layout, board: Kanban } as const;

/** 工作区标题栏的「排列」按钮：切换抽屉排列方式 */
export function ArrangeMenu({ value, onChange }: { value: Arrange; onChange: (v: Arrange) => void }) {
  const Icon = ARRANGE_ICON[value];
  return (
    <DropdownMenu>
      <Tooltip content={tr('排列：{0}', ARRANGE_LABEL[value])} side="bottom">
        <DropdownMenu.Trigger render={<Button variant="ghost" size="xs" shape="square" icon={<Icon />} aria-label={tr('排列：{0}', ARRANGE_LABEL[value])} />} />
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
