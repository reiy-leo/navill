/**
 * 结构共享：把 next 中与 prev 深度相等的部分换成 prev 里的同一引用。
 * 数据库实时查询每次都会返回全新对象；共享后没变的抽屉、书签保持引用不变，
 * React.memo 才能跳过它们的重渲染。只处理普通对象与数组，其余按 === 比较。
 */
export function replaceEqualDeep<T>(prev: unknown, next: T): T {
  if (prev === next) return next;
  const pa = Array.isArray(prev), na = Array.isArray(next);
  if (pa && na) {
    const p = prev as unknown[], n = next as unknown[];
    let same = p.length === n.length;
    const out = n.map((v, i) => { const r = replaceEqualDeep(p[i], v); if (r !== p[i]) same = false; return r; });
    return (same ? p : out) as T;
  }
  if (!pa && !na && isPlain(prev) && isPlain(next)) {
    const p = prev as Record<string, unknown>, n = next as Record<string, unknown>;
    const pk = Object.keys(p), nk = Object.keys(n);
    let same = pk.length === nk.length;
    const out: Record<string, unknown> = {};
    for (const k of nk) { const r = replaceEqualDeep(p[k], n[k]); out[k] = r; if (r !== p[k] || !(k in p)) same = false; }
    return (same ? p : out) as T;
  }
  return next;
}

function isPlain(v: unknown): v is object {
  if (!v || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}
