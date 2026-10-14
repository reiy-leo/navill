/** 工作区名称里的 emoji 处理：名称不保留 emoji，前两个 emoji 合起来作为图标 */
const PICTO = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });

export function isEmoji(grapheme: string): boolean {
  return PICTO.test(grapheme);
}

/** 工作区图标最多由几个 emoji 组成 */
export const MAX_ICON_EMOJIS = 2;

/** 拆出名称中的 emoji：返回前两个 emoji 拼成的图标，和去掉全部 emoji 后的名称 */
export function splitEmoji(raw: string): { emoji?: string; name: string } {
  const icons: string[] = [];
  let name = '';
  for (const { segment } of segmenter.segment(raw)) {
    if (isEmoji(segment)) { if (icons.length < MAX_ICON_EMOJIS) icons.push(segment); }
    else name += segment;
  }
  return { emoji: icons.join('') || undefined, name: name.replace(/\s+/g, ' ').trim() };
}

/** 图标输入：只保留 emoji，最多两个（按字素计，复合 emoji 算一个） */
export function limitIcon(raw: string): string {
  const out: string[] = [];
  for (const { segment } of segmenter.segment(raw)) {
    if (isEmoji(segment) && out.length < MAX_ICON_EMOJIS) out.push(segment);
  }
  return out.join('');
}

/** 图标里有几个 emoji */
export const iconCount = (icon: string) => [...segmenter.segment(icon)].length;

/** 去掉名称中的 emoji */
export const stripEmoji = (raw: string) => splitEmoji(raw).name;
