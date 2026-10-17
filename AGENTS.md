# AGENTS.md — Navill

给 AI 编程代理与协作者的项目说明。产品细节见 [docs/PRODUCT.md](docs/PRODUCT.md)，完整计划与决策记录见 [docs/PLAN.md](docs/PLAN.md)。

## 目标
Chrome / Edge MV3 扩展：一次性导入浏览器书签，重组为「工作区 → 抽屉 → 书签」，替换新标签页 + 工具栏弹窗；Navill 数据本地优先，经 Google Drive `appDataFolder` 或 WebDAV `navill-bookmarks/` 同步（二选一，`src/lib/sync/backend.ts`）。

## 边界（不做）
- 与浏览器书签持续双向同步
- 标签页 / 会话管理、侧边栏入口
- 书签内容抓取、AI 自动分类
- 任何遥测或第三方统计；数据只在本地与用户自己的 Drive

## 技术栈
- WXT 0.21 + TypeScript（strict）+ Vite；React 19
- UI：Kumo（`@cloudflare/kumo`）+ Tailwind CSS v4；图标 `@phosphor-icons/react`（Kumo 配套）；明暗主题跟随系统（`<html data-mode>`）
- 存储：Dexie（IndexedDB）为事实来源；设置放 `chrome.storage.local`
- 测试：Vitest（单测）；Playwright（E2E，M2 起）
- 包管理：pnpm

## 目录
```
entrypoints/
  background.ts      service worker（同步 alarm、安装引导）
  newtab/            新标签页
  popup/             工具栏弹窗
src/
  db/                Dexie 数据模型（对应 PLAN §4）
  lib/               纯逻辑：导入、拍平、Edge 工作区识别、分身、同步合并（必须有单测）
  ui/                共享 UI 与主题
assets/app.css       Tailwind + Kumo 样式入口
public/icon/         扩展图标
docs/                PLAN.md、PRODUCT.md
.agents/             skills / rules / prompts / memory
```

## 命令
| 命令 | 作用 |
|---|---|
| `pnpm install` | 安装依赖（会自动 `wxt prepare` 生成类型） |
| `pnpm dev` / `pnpm dev:edge` | 开发模式 |
| `pnpm build` / `pnpm build:edge` | 构建到 `.output/chrome-mv3` / `.output/edge-mv3` |
| `pnpm zip` / `pnpm zip:edge` | 打包商店 zip |
| `pnpm compile` | TypeScript 类型检查 |
| `pnpm test` | Vitest |

## 代码规范
- 界面文案全部中文；HTTP 状态码出现时附中文说明（如「408 请求超时」）。
- 术语固定：工作区 / 抽屉 / 书签 / 分身 / 分身书签组 / 待整理。代码中浏览器侧的 Edge 工作区一律叫 `edgeWorkspaceNode`，与 Navill 的 `Workspace` 严格区分。
- 分身是引用（`Placement.isAlias`），标题与 URL 永远读原书签；打开次数合并计数。
- 本地优先：UI 永不等待网络；结构改动写入 Outbox，由后台批量同步。
- 能用 Kumo 组件就不要手写；Kumo 文档：`npx @cloudflare/kumo doc <组件名>`。
- `src/lib` 下的逻辑必须有 Vitest 单测。

## 禁止事项
- 不提交任何密钥、OAuth secret、`.keys/`、`.env`。
- 不请求计划外的权限；新增权限需先更新 PLAN 并说明理由。
- 不引入遥测、远程代码或 CDN 脚本（MV3 也不允许）。
- 不写入浏览器书签（只读 `chrome.bookmarks`）。

## 工作约定
- 每轮修改完成后 commit 并 push 到 `main`（提交信息用中文，前缀 feat/fix/docs/chore）。
- 推送前跑 `pnpm compile && pnpm test`。
- 决策有变时同步更新 `docs/PLAN.md`。

## 尺寸与提示文字（2026-10-14）
- 按钮/图标向浏览器工具栏看齐：按钮约 32px、图标 20px。`assets/app.css` 统一放大了 Kumo 的 xs/sm 按钮和按钮内 svg，照常写 `size="sm"` 即可，不要再手动缩小图标。
- 说明性文字不要常驻占版面，用 `src/ui/InfoTip.tsx`（ⓘ，悬停或点击显示）。状态类短文字（已授权、上次同步时间）可以常显。
- 文案不用括号备注：菜单项、按钮、标签名保持简短（「创建分身」而不是「创建分身（挂载到其他抽屉）」），补充说明放 InfoTip、placeholder 或确认对话框。
- 字号只用三档：正文、标签、按钮、输入框、下拉、页签 13px（`text-sm`）；次要说明与状态 12px（`text-xs`）；页面与弹窗标题 16px（`text-base font-medium` / 弹窗标题）。Kumo 控件的 12/14px 已在 `assets/app.css` 统一拉齐，不要再写 `text-[Npx]`。
- 右键菜单和 ⋯ 菜单按功能分组，组间用分割线（ContextMenu `{ divider: true }`、`DropdownMenu.Separator`），危险操作单独一组放最后。

## 快捷键 / 提醒 / 日志（2026-10-15）
- 提醒用 `src/ui/toast.tsx` 的 `toast()`，不要另起一套；书签操作的提醒由日志事件（`onLogged`）驱动，新的写操作只要在 store 层记日志就会自动提醒。
- 用户写操作在 store 层用 `logged(db, async (log) => …)` 包裹并调用 `log()`；嵌套调用自动只记最外层。同步合并、导入、恢复备份直接写表，不记日志。
- 页面快捷键集中在 `src/ui/feedback.ts` 的 `useShortcuts`（捕获阶段）；⌘S 跳过规则是 `src/lib/sync/shortcut.ts` 纯函数。
- 「新建工作区」「归档」在 ⋯ 菜单里，不要再放回导航栏。

## 版本与发布
- 版本号只写在 `package.json`。从 0.2.0 起开发中用预发布版本 `X.Y.Z-alpha.N`（WXT 会把清单 `version` 写成 `X.Y.Z`、`version_name` 写成完整版本）。
- 发布 = 推送与 `package.json` 一致的 tag：`.github/workflows/release.yml` 自动创建 GitHub Release，附 Chrome/Edge zip：`vX.Y.Z-alpha.N` 标为 Pre-release，提交列表从上一个 tag 起算；`vX.Y.Z` 正式版的提交列表从上个正式版起算。
- Google OAuth 客户端 ID 是公开信息，默认值写在 `src/lib/sync/auth.ts`，CI 打包无需任何 Secret；`.env` 的 `WXT_GOOGLE_CLIENT_ID` 只用于 fork 覆盖。
