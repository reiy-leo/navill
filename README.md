# Navill

Chrome / Edge 扩展：一次性导入浏览器书签，按「工作区 → 抽屉 → 书签」重新组织，作为新标签页导航使用；支持分身、分身书签组，数据通过 Google Drive 同步。

> 状态：v0.1.0，M0–M5 已实现（导入、工作区/抽屉/书签、分身与分身书签组、场景、标签、归档、导入导出、Google Drive 同步）。完整计划见 [docs/PLAN.md](docs/PLAN.md)。

## 本地构建

需要 Node 22+ 与 pnpm 10+。

```bash
pnpm install
pnpm build         # Chrome → .output/chrome-mv3
pnpm build:edge    # Edge   → .output/edge-mv3
pnpm dev           # 开发模式，热更新
pnpm zip           # 打包上架用 zip
```

加载：打开 `chrome://extensions`（Edge 为 `edge://extensions`），开启「开发者模式」，点「加载已解压的扩展程序」，选择对应的 `.output/*-mv3` 目录。

## Google Drive 同步配置

1. Google Cloud Console 新建 OAuth 客户端（类型：Web 应用），启用 Google Drive API，OAuth 同意屏幕只加 `drive.appdata` scope。
2. 已获授权的重定向 URI：Chrome、Edge 各加一个 `https://<扩展 ID>.chromiumapp.org/`（设置 → 同步页会显示本机扩展的回调地址）。
3. 复制 `.env.example` 为 `.env`，填 `WXT_GOOGLE_CLIENT_ID`；想让本地加载的扩展 ID 固定，可再填 `WXT_EXTENSION_KEY`（manifest key）。
4. 重新 `pnpm build`。

## 技术栈

WXT · TypeScript · React · [Kumo](https://www.npmjs.com/package/@cloudflare/kumo) · Tailwind CSS v4 · Dexie (IndexedDB) · Vitest

## 许可

MIT
