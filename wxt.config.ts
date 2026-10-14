import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// 一套代码同时构建 Chrome 与 Edge（wxt build -b edge）
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'Navill',
    description: '把浏览器书签重组为「工作区 → 抽屉 → 书签」的新标签页导航',
    permissions: ['bookmarks', 'storage', 'unlimitedStorage', 'favicon', 'identity', 'alarms'],
    host_permissions: ['https://www.googleapis.com/*'],
    action: { default_title: 'Navill' },
  },
});
