/** 浏览器 _favicon API（需 favicon 权限），不发起外部请求 */
export function faviconUrl(pageUrl: string, size = 32): string {
  const base = (browser.runtime.getURL as (p: string) => string)('/_favicon/');
  return `${base}?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`;
}
