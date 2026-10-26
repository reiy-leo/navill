/**
 * GitHub star：按用户名读公开 star 列表（不需要登录）。
 * 未登录的接口每小时 60 次（按 IP），所以结果在本机缓存 30 分钟。
 */
export interface Star { fullName: string; url: string; description: string; language: string; starredAt: number }

const TTL = 30 * 60_000;
const cacheKey = (user: string) => `navill-gh-stars:${user.toLowerCase()}`;
const DISMISSED = 'navill-gh-dismissed';

export class GitHubError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** 用户名只允许字母数字和连字符；也接受粘贴的主页链接或 @name */
export function cleanUser(raw: string): string {
  const s = raw.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?github\.com\//i, '').split(/[/?#]/)[0] ?? '';
  return /^[a-z\d](?:[a-z\d-]{0,38})$/i.test(s) ? s : '';
}

export async function fetchStars(user: string, opts: { force?: boolean; fetch?: typeof fetch } = {}): Promise<Star[]> {
  const key = cacheKey(user);
  if (!opts.force) {
    try {
      const c = JSON.parse(localStorage.getItem(key) ?? 'null') as { at: number; items: Star[] } | null;
      if (c && Date.now() - c.at < TTL) return c.items;
    } catch { /* 缓存坏了就重新拉 */ }
  }
  const f = opts.fetch ?? fetch;
  const r = await f(`https://api.github.com/users/${encodeURIComponent(user)}/starred?per_page=30`, {
    headers: { Accept: 'application/vnd.github.star+json' },
  });
  if (!r.ok) throw new GitHubError(r.status, `HTTP ${r.status}`);
  const raw = (await r.json()) as Array<{ starred_at: string; repo: { full_name: string; html_url: string; description: string | null; language: string | null } }>;
  const items = raw.map((x) => ({
    fullName: x.repo.full_name,
    url: x.repo.html_url,
    description: x.repo.description ?? '',
    language: x.repo.language ?? '',
    starredAt: Date.parse(x.starred_at) || 0,
  }));
  try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), items })); } catch { /* 存不下就算了 */ }
  return items;
}

export function dismissedStars(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED) ?? '[]') as string[]); } catch { return new Set(); }
}
export function dismissStar(url: string) {
  const s = [...dismissedStars(), url].slice(-500);
  localStorage.setItem(DISMISSED, JSON.stringify(s));
}

/** 网址比对时忽略大小写和末尾斜杠 */
export const normUrl = (u: string) => u.trim().toLowerCase().replace(/\/+$/, '');
