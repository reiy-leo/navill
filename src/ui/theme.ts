/** 明暗主题跟随系统：Kumo 通过 <html data-mode="dark"> 切换 */
export function followSystemTheme(): void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    document.documentElement.dataset.mode = mq.matches ? 'dark' : 'light';
  };
  apply();
  mq.addEventListener('change', apply);
}
