# 家教星球 10.20 版本

> 版本基线：2026-10-20。以当前统一身份首页、老师端、家长端和管理端完整代码为基准；后续升级均在此版本上继续。

家教星球是一套统一的家教订单运营系统：老师端、家长端和管理端共用同一应用、服务端 API 与数据存储。

此公开仓库版本仅包含源码。渠道显示名称与默认分成已改为匿名演示值；本地正在使用的数据库、账号配置、订单和老师资料没有上传。部署真实业务前，请在后台重新核对各渠道分成，并单独迁移数据库。

## 本地运行

环境要求：Node.js 22.13+、pnpm。

```powershell
pnpm install
Copy-Item .env.example .env.local
# 在 .env.local 中设置管理员及超级管理员账号密码
pnpm dev
```

打开 `http://localhost:3000/`。如需使用其他端口，可用 `pnpm exec next dev -p 3001`。

## 入口

- 统一身份首页：`/`
- 老师端订单：`/teacher`
- 老师登记：`/teacher/register`
- 家长端：`/parent`
- 家长需求提交：`/parent/request`
- 管理员登录：`/auth`
- 内部运营后台：`/manage`

## 数据与安全

服务端使用 Node.js 内置 SQLite，默认数据库路径为 `data/tutor-v1.sqlite`，可通过 `TUTOR_DB_PATH` 配置。数据库、运行日志、临时文件和 `.env.local` 不属于公开源码，已在 `.gitignore` 中排除。`.env.example` 仅提供空白配置项。

新库首次启动默认写入虚构演示订单。若首次初始化空库，在 `.env.local` 设置 `TUTOR_EMPTY_DB=1`。现有本地数据库需通过备份和迁移流程部署，不能提交到 GitHub。

## 常用命令

```powershell
pnpm typecheck
pnpm build
pnpm start
node tests/v1-closure.cjs
node tests/jiang-batch.cjs
node tests/parser-v2.cjs
```

`node tests/v1-http.cjs` 用于服务运行后的 HTTP 与登录检查。它读取 `.env.local` 中配置的管理员凭据；不要把凭据写入代码或公开日志。

## 部署边界

当前项目是可本地运行的 Next.js 应用，SQLite 必须位于持久化磁盘。部署时需配置强密码、HTTPS、数据库备份与恢复方案。请使用支持持久磁盘的 Node.js 主机；不要直接放到无状态静态托管或临时文件系统中。

仓库同时保留老师端微信小程序源码（`miniprogram/`）。`miniprogram/data/snapshot.js` 是从业务数据库生成的订单快照，可能含业务信息，因此不随公开源码上传；小程序预览需先由运营人员检查并生成合适的数据快照。

详细版本说明见 [V2.0.md](V2.0.md)。
