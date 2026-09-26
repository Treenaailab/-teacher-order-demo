# 家教星球 V1

家教订单浏览与内部运营管理系统，手机端优先。此目录是 Next.js 应用源码；当前演示数据保存在浏览器本地存储。

## 本地启动

1. 安装 Node.js 与 pnpm。
2. 复制 `.env.example` 为 `.env.local`，填写管理员账号密码及可选的 Supabase 配置。
3. 运行 `pnpm install` 和 `pnpm dev`，打开 `http://localhost:3000`。

管理员环境变量：`TUTOR_ADMIN_USERNAME`、`TUTOR_ADMIN_PASSWORD`、`TUTOR_SUPERADMIN_USERNAME`、`TUTOR_SUPERADMIN_PASSWORD`。本源码不包含本地 `.env.local` 或管理员凭据。

## 数据与权限

未配置 Supabase 时使用虚构演示订单，录入数据仅保存在当前浏览器。超级管理员可编辑和删除已录订单；普通管理员处理日常运营。Supabase 表结构在 `supabase/schema.sql`，尚未连接到正式数据库。

为了保护订单隐私，本分支不包含含原始地址和订单文本的 SQL 样例文件；解析器演示样本使用虚构区域。

## 发布说明

GitHub Pages 只能托管静态文件，不能运行此 Next.js 应用中的登录接口和管理后台。公开运行需要支持 Next.js 服务端路由的托管环境，并在其安全环境变量中配置管理员凭据。