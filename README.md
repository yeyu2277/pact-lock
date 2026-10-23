# Pact Lock

[English](./README.md) | [简体中文](./README.zh-CN.md)

Pact Lock is a smart contract application for trades backed by deposits from both parties. Participants agree on the terms off-chain and deposit the payment and collateral on-chain. Once both confirm completion, the contract settles the order and each participant claims their funds separately.

This repository contains the Pact Lock frontend, built with Nuxt SSR, JavaScript and Vue. It supports SEO and multiple languages, connects wallets through Reown, and reads blockchain data directly.

## Features

- Create, find and share orders; view participants, funding and current status.
- Public or designated counterparties, with native currencies and ERC20 tokens.
- Fund, confirm, cancel and claim through a connected wallet.
- Personal order history with manual synchronization and browser caching.
- Desktop and mobile layouts with a usage guide in English, Simplified and Traditional Chinese, Spanish, Brazilian Portuguese, Japanese, Korean, Vietnamese and Indonesian.

## Tech stack

Nuxt 4 · Vue 3 · Nuxt UI · Tailwind CSS · Nuxt i18n · Pinia · ethers.js · Reown AppKit

## Getting started

Use Node.js 22.22.3 and npm 10.9.8 or later; see `package.json` for supported versions.

```powershell
npm ci

# Create the development configuration once; skip if it already exists.
Copy-Item .env.example .env.development
```

Set `NUXT_PUBLIC_REOWN_PROJECT_ID` in `.env.development`, then run:

```powershell
npm run dev
```

Open `http://localhost:3000` or `http://127.0.0.1:3000`. Devices on the same LAN can use `http://YOUR_LAN_IP:3000`. Check the startup output for the actual address and port.

## Configuration and deployment

- See `.env.example` for configuration. Actual `.env.development` and `.env.production` files are excluded from Git.
- Wallet connections require a Reown project ID. Configure your site's domains in the Reown Dashboard.
- Networks, RPC endpoints, contracts, ERC20 presets and GitHub / Telegram / X links use environment variables. Contract functionality is enabled on Polygon Amoy and Polygon mainnet, with USDC, USDT0 and DAI (PoS) presets on mainnet.
- Share images are configured in `app/config/site.js`; languages in `app/config/locales.js`.

Prepare `.env.production` with `NODE_ENV=production`, your site URL and Reown project ID, then run:

```powershell
npm run build
npm start
```

After deploying the SSR server, edit `.env.production` and restart `npm start` to update these settings without rebuilding. You can also inject the same environment variables through your hosting platform; system variables take precedence over the file. Refresh existing browser tabs to load the changes. If deploying only `.output/`, place `.env.production` alongside it and run `node --env-file=.env.production .output/server/index.mjs`. Static exports do not support these runtime updates.

`NUXT_PUBLIC_NETWORKS_JSON` replaces the complete network list, including `tokens`, `pactLock`, RPC and fee settings; it is not a partial merge. `NUXT_PUBLIC_DEFAULT_CHAIN_ID` must identify an enabled business network with a contract deployment and also controls the fallback network switch prompt. Set project and contact links with `NUXT_PUBLIC_GITHUB_URL`, `NUXT_PUBLIC_TELEGRAM_URL` and `NUXT_PUBLIC_X_URL`. Invalid configuration stops startup and identifies the affected field.

These settings are public in the browser. Do not include private keys or server secrets. Network and token icons use local paths; upload new assets to `.output/public/` as well. An empty network configuration uses the defaults in `app/config/networks.js`.

## Development

Pages live in `app/pages/`, shared components in `app/components/`, and contract interactions in `app/contracts/`. The contract source is in `contracts/PactLock.sol`. Local assets and their source notes are in `public/`.
