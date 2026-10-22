import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// 一套代码同时构建 Chrome、Edge（wxt build -b edge）与 Firefox（wxt build -b firefox，MV3）
// 可选：固定扩展 ID（OAuth 回调需要稳定 ID），在 .env 中设置 WXT_EXTENSION_KEY=<manifest key>
// 默认公钥固定开发版扩展 ID = omliccmdddkdjnnkeajhfeljnfgkeagn（公钥不是机密；私钥只在项目 .keys/，不入库）。
// 上架商店时设 WXT_EXTENSION_KEY=none 去掉 key，商店会分配自己的 ID。
const DEV_KEY = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAo0g/Tf3qzkt4fNnUUIBq3DyJJntHA83h3a2uhX0aW5HUUwt8x83xNDK35dPwh4qHCtij89wA9nNYsxnpDf1yqcHIyIxo5mjis3rqhttZCcQl6nj9vnuCoYNg2QHCTRprdIasCHtZchzFsM9/O/qgY/NRK6Itob6o+NzNyb6ITDUutWnaZhkYKu32ZjYxNdfUQEMXUZSh/xrI5Wgdf17WfW2kzDKTl3DBJb4vjRTTYNVqbWbxTfJC9uPDXt/Sw6zCMkmOsDHtlv9XlyH6YVD3M1LYRguL3xeZ/nZxZJyGsF7yKD1fKQyxqdM5IPCbFNPNYIUSGWp2u4K66T3Vj/E4OwIDAQAB';
const envKey = process.env.WXT_EXTENSION_KEY;
const key = envKey === 'none' ? undefined : envKey || DEV_KEY;

/** Firefox 附加组件 ID，上架 AMO 后永久固定，不要改 */
const GECKO_ID = 'navill@rei8t.dev';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // Firefox 也用 MV3（WXT 对 Firefox 默认是 MV2）
  manifestVersion: 3,
  // Firefox 源码包（AMO 审核要求）不带商店素材
  zip: { excludeSources: ['assets/store/**'] },
  vite: () => ({ plugins: [tailwindcss()] }),
  hooks: {
    // 页面类入口（newtab / popup）拆分第三方依赖，避免单个 chunk 超过 500 kB 的构建警告；
    // background 是单文件 IIFE，不能拆分，跳过
    'vite:build:extendConfig': (entrypoints, config) => {
      if (entrypoints.some((e) => e.type === 'background' || e.type === 'content-script')) return;
      const ro = ((config.build ??= {}).rolldownOptions ??= {});
      const prev = Array.isArray(ro.output) ? ro.output[0] : ro.output;
      ro.output = { ...prev, codeSplitting: {
        groups: [
          { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
          { name: 'ui-kit', test: /node_modules[\\/](@cloudflare[\\/]kumo|@base-ui)/, priority: 20 },
          { name: 'icons', test: /node_modules[\\/]@phosphor-icons/, priority: 20 },
          // lucide 图标保持按需单独加载，不并入 vendor
          { name: 'vendor', test: (id: string) => /node_modules/.test(id) && !/lucide-react/.test(id), priority: 10 },
        ],
      } };
    },
  },
  manifest: ({ browser }) => ({
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    homepage_url: 'https://navill.rei8t.dev',
    default_locale: 'zh_CN',
    // favicon 是 Chromium 专属权限（_favicon 接口），Firefox 不认
    permissions: ['bookmarks', 'storage', 'unlimitedStorage', ...(browser === 'firefox' ? [] : ['favicon']), 'identity', 'alarms'],
    host_permissions: ['https://www.googleapis.com/*', 'https://icon.horse/*', 'https://www.google.com/s2/*', 'https://*.gstatic.com/*', 'https://navill.rei8t.dev/*'],
    // 可选：读取网页自身的高清图标（apple-touch-icon / manifest），在 设置 → 通用 里授权
    optional_host_permissions: ['<all_urls>'],
    // 可选：新建 / 编辑书签时用浏览记录自动补全
    optional_permissions: ['history'],
    action: { default_title: 'Navill' },
    // 地址栏输入 nv + 空格搜索 Navill 书签
    omnibox: { keyword: 'nv' },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: GECKO_ID,
              // 内置的数据收集声明需要 Firefox 140+
              strict_min_version: '140.0',
              // 书签只在用户开启同步（自己的 Google Drive / WebDAV）或发布分享时传出，声明为可选
              data_collection_permissions: { required: ['none'], optional: ['bookmarksInfo'] },
            },
          },
        }
      : key ? { key } : {}),
  }),
});
