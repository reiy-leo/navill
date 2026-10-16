import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// 一套代码同时构建 Chrome 与 Edge（wxt build -b edge）
// 可选：固定扩展 ID（OAuth 回调需要稳定 ID），在 .env 中设置 WXT_EXTENSION_KEY=<manifest key>
// 默认公钥固定开发版扩展 ID = omliccmdddkdjnnkeajhfeljnfgkeagn（公钥不是机密；私钥只在项目 .keys/，不入库）。
// 上架商店时设 WXT_EXTENSION_KEY=none 去掉 key，商店会分配自己的 ID。
const DEV_KEY = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAo0g/Tf3qzkt4fNnUUIBq3DyJJntHA83h3a2uhX0aW5HUUwt8x83xNDK35dPwh4qHCtij89wA9nNYsxnpDf1yqcHIyIxo5mjis3rqhttZCcQl6nj9vnuCoYNg2QHCTRprdIasCHtZchzFsM9/O/qgY/NRK6Itob6o+NzNyb6ITDUutWnaZhkYKu32ZjYxNdfUQEMXUZSh/xrI5Wgdf17WfW2kzDKTl3DBJb4vjRTTYNVqbWbxTfJC9uPDXt/Sw6zCMkmOsDHtlv9XlyH6YVD3M1LYRguL3xeZ/nZxZJyGsF7yKD1fKQyxqdM5IPCbFNPNYIUSGWp2u4K66T3Vj/E4OwIDAQAB';
const envKey = process.env.WXT_EXTENSION_KEY;
const key = envKey === 'none' ? undefined : envKey || DEV_KEY;

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'Navill',
    description: '把浏览器书签重组为「工作区 → 抽屉 → 书签」的新标签页导航',
    permissions: ['bookmarks', 'storage', 'unlimitedStorage', 'favicon', 'identity', 'alarms'],
    host_permissions: ['https://www.googleapis.com/*', 'https://icon.horse/*', 'https://www.google.com/s2/*', 'https://*.gstatic.com/*', 'https://navill.rei8t.dev/*'],
    // 可选：读取网页自身的高清图标（apple-touch-icon / manifest），在 设置 → 通用 里授权
    optional_host_permissions: ['<all_urls>'],
    // 可选：新建 / 编辑书签时用浏览记录自动补全
    optional_permissions: ['history'],
    action: { default_title: 'Navill' },
    // 地址栏输入 nv + 空格搜索 Navill 书签
    omnibox: { keyword: 'nv' },
    ...(key ? { key } : {}),
  },
});
