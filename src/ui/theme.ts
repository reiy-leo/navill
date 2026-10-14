import { getSettings, settingsItem } from '@/src/lib/settings';

/** 主题：浅色 / 深色 / 跟随系统；Kumo 通过 <html data-mode="dark"> 切换 */
export function followTheme(): void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  let pref: 'system' | 'light' | 'dark' = (localStorage.getItem('navill.theme') as never) ?? 'system';
  const apply = () => {
    const dark = pref === 'dark' || (pref === 'system' && mq.matches);
    document.documentElement.dataset.mode = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  };
  apply(); // 先用 localStorage 缓存同步应用，避免首屏闪烁
  mq.addEventListener('change', apply);
  const sync = async () => {
    pref = (await getSettings()).theme;
    localStorage.setItem('navill.theme', pref);
    apply();
  };
  void sync();
  settingsItem.watch(() => void sync());
}
