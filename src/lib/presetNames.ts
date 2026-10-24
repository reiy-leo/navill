import { tr, translationsOf } from '@/src/i18n';

/**
 * 预设场景与内置标签的名称随界面语言切换：库里存的名称若仍是任一语言的预设名
 *（用户没改过），显示时换成当前语言；用户改过的名称原样显示。
 */
const PRESET_KEYS: Record<string, string> = {
  'mode-default': '默认',
  'mode-work': '工作',
  'mode-home': '居家',
  'mode-talk': '演讲',
  'mode-lend': '借用',
  'tag-favorite': '收藏',
  'tag-todo': '待办',
};

export function presetName(id: string, name: string): string {
  const key = PRESET_KEYS[id];
  if (!key) return name;
  const n = name.trim();
  return translationsOf(key).includes(n) ? tr(key) : name;
}

export function localizeNames<T extends { id: string; name: string }>(items: T[]): T[] {
  return items.map((x) => {
    const name = presetName(x.id, x.name);
    return name === x.name ? x : { ...x, name };
  });
}
