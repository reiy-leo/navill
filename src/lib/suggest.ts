/** 新建 / 编辑书签时的自动补全：来自浏览器历史记录（可选权限 history，只读本机） */
export interface Suggestion { url: string; title: string; visits: number }

export const hasHistory = () => browser.permissions.contains({ permissions: ['history'] }).catch(() => false);
export const requestHistory = () => browser.permissions.request({ permissions: ['history'] }).catch(() => false);

const ok = (u: string) => /^https?:\/\//.test(u);

/** 关键词同时匹配标题和网址；按访问次数排序，去重后取前 limit 条 */
export function rankSuggestions(items: { url?: string; title?: string; visitCount?: number; typedCount?: number }[], limit = 8): Suggestion[] {
  const seen = new Set<string>();
  return items
    .filter((h): h is { url: string; title?: string; visitCount?: number; typedCount?: number } => !!h.url && ok(h.url))
    .map((h) => ({ url: h.url, title: (h.title ?? '').trim(), visits: (h.visitCount ?? 0) + (h.typedCount ?? 0) * 2 }))
    .sort((a, b) => b.visits - a.visits)
    .filter((s) => { const k = s.url.replace(/\/$/, ''); return seen.has(k) ? false : (seen.add(k), true); })
    .slice(0, limit);
}

export async function suggest(text: string, limit = 8): Promise<Suggestion[]> {
  const q = text.trim().replace(/^https?:\/\//, '');
  if (q.length < 2 || !browser.history) return [];
  const items = await browser.history.search({ text: q, startTime: 0, maxResults: 50 }).catch(() => []);
  return rankSuggestions(items, limit);
}
