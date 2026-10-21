/** 名称按显示宽度计长：中日韩文字与全角符号计 2，其他计 1 */
const WIDE = /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6\u{20000}-\u{3FFFD}]/u;

/** 工作区名称的宽度上限：12 个汉字或 24 个字母 */
export const NAME_MAX_WIDTH = 24;

export const textWidth = (s: string) => Array.from(s).reduce((n, c) => n + (WIDE.test(c) ? 2 : 1), 0);

/** 截到不超过 max 宽度 */
export function clipWidth(s: string, max: number): string {
  let n = 0, out = '';
  for (const c of s) { n += WIDE.test(c) ? 2 : 1; if (n > max) break; out += c; }
  return out;
}
