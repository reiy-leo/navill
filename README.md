# Navill

Chrome / Edge 扩展：一次性导入浏览器书签，按「工作区 → 抽屉 → 书签」重新组织，作为新标签页导航使用；支持分身、分身书签组，数据通过 Google Drive 同步。

> 状态：M0 脚手架。完整计划见 [docs/PLAN.md](docs/PLAN.md)。

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

## 技术栈

WXT · TypeScript · React · [Kumo](https://www.npmjs.com/package/@cloudflare/kumo) · Tailwind CSS v4 · Dexie (IndexedDB) · Vitest

## 许可

MIT
