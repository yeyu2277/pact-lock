# Pact Lock

[English](./README.md) | [简体中文](./README.zh-CN.md)

Pact Lock 是一个基于智能合约的双方承诺质押交易网站。双方在线下约定交易内容，在链上存入交易资金和押金；分别确认完成后，由合约自动结算，再各自领取资金。

本仓库为 Pact Lock 前端，采用 Nuxt SSR、JavaScript 和 Vue 开发，支持 SEO 和多语言，通过 Reown 连接钱包，直接读取链上数据。

## 主要功能

- 发布、查询和分享订单，查看双方资金及当前状态。
- 支持公开接单和指定对手，以及原生币和 ERC20 代币。
- 通过钱包完成入金、确认、取消和领取操作。
- 个人中心展示相关订单，支持手动同步与浏览器缓存。
- 适配桌面与移动端，提供使用指南，支持英语、简繁中文、西班牙语、巴西葡萄牙语、日语、韩语、越南语和印尼语。

## 技术栈

Nuxt 4 · Vue 3 · Nuxt UI · Tailwind CSS · Nuxt i18n · Pinia · ethers.js · Reown AppKit

## 快速开始

推荐使用 Node.js 22.22.3 和 npm 10.9.8 或以上，兼容版本见 `package.json`。

```powershell
npm ci

# Create the configuration once; skip copying if the file already exists.
Copy-Item .env.example .env.development
```

在 `.env.development` 中填写 `NUXT_PUBLIC_REOWN_PROJECT_ID`，然后启动：

```powershell
npm run dev
```

本机访问 `http://localhost:3000` 或 `http://127.0.0.1:3000`；同一局域网的设备使用 `http://本机局域网IP:3000`。实际端口与地址以启动输出为准。

## 配置与部署

- 环境配置参考 `.env.example`；实际的 `.env.development` 和 `.env.production` 不提交到 Git。
- Reown project ID 用于钱包连接，站点访问域名需在 Reown Dashboard 中配置。
- 网络、RPC、合约、ERC20 列表及 GitHub／TG／X 地址通过环境变量配置，字段与格式见 `.env.example`。Polygon Amoy 和 Polygon 主网均已启用合约业务，主网预置 USDC、USDT0 和 DAI（PoS）。
- 分享图位于 `app/config/site.js`；语言配置位于 `app/config/locales.js`。

部署前准备 `.env.production`，设置 `NODE_ENV=production`、正式站点地址和 Reown project ID，再执行：

```powershell
npm run build
npm start
```

SSR 部署后修改 `.env.production` 并重启 `npm start` 即可更新上述配置，无需重新构建；服务器也可直接注入同名环境变量，系统变量优先于文件。已打开的网页刷新后生效。仅部署 `.output/` 时，在其父目录放置 `.env.production`，使用 `node --env-file=.env.production .output/server/index.mjs` 启动。纯静态导出不支持这种运行时更新。

`NUXT_PUBLIC_NETWORKS_JSON` 是完整网络列表，包含 `tokens`、`pactLock`、RPC 和费率等设置；配置不是局部合并。`NUXT_PUBLIC_DEFAULT_CHAIN_ID` 必须指向已启用且配置合约的业务网络，也用于不支持网络时的切换提示。GitHub、TG、X 分别使用 `NUXT_PUBLIC_GITHUB_URL`、`NUXT_PUBLIC_TELEGRAM_URL`、`NUXT_PUBLIC_X_URL`。配置格式错误会阻止服务启动并指出字段。

这些配置会公开给浏览器，不要填写私钥或私密服务端密钥。网络／代币图标使用本地路径，新增素材需同时上传到 `.output/public/`。配置为空时使用 `app/config/networks.js` 内置网络。

## 开发入口

页面位于 `app/pages/`，公共组件位于 `app/components/`，合约交互位于 `app/contracts/`。合约源码保存在 `contracts/PactLock.sol`，本地素材与来源说明位于 `public/`。
