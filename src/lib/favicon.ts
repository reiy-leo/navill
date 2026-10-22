/**
 * 浏览器自带的网站图标：Chromium 用 _favicon API（需 favicon 权限），不发起外部请求；
 * Firefox 没有 _favicon，退回 Google s2 图标服务（已在 host_permissions 内）。
 */
export function faviconUrl(pageUrl: string, size = 32): string {
  if (import.meta.env.BROWSER === 'firefox') {
    return `https://www.google.com/s2/favicons?sz=${size}&domain_url=${encodeURIComponent(pageUrl)}`;
  }
  const base = (browser.runtime.getURL as (p: string) => string)('/_favicon/');
  return `${base}?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`;
}
