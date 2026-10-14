/** 工作区名称里的 emoji 处理：名称不保留 emoji，第一个 emoji 作为图标 */
const PICTO = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });

export function isEmoji(grapheme: string): boolean {
  return PICTO.test(grapheme);
}

/** 拆出名称中的 emoji：返回第一个 emoji（图标）和去掉全部 emoji 后的名称 */
export function splitEmoji(raw: string): { emoji?: string; name: string } {
  let emoji: string | undefined;
  let name = '';
  for (const { segment } of segmenter.segment(raw)) {
    if (isEmoji(segment)) emoji ??= segment;
    else name += segment;
  }
  return { emoji, name: name.replace(/\s+/g, ' ').trim() };
}

/** 去掉名称中的 emoji */
export const stripEmoji = (raw: string) => splitEmoji(raw).name;
