# ⛓️ NEXORUM OS — Blockchain Engine

> **Модульное ядро блокчейна** для NEXORUM OS. Поддерживает мульти-сетевую архитектуру через плагины, AI-аналитику, токен-лаунчпад и агрегацию портфеля.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF)](https://vitejs.dev/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-Edge-orange)](https://workers.cloudflare.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🚀 Быстрый старт

```bash
# Клонирование
git clone https://github.com/your-org/nexorum-blockchain-engine.git
cd nexorum-blockchain-engine

# Установка зависимостей
npm install

# Локальный запуск (Express + Vite)
npm run dev

# Локальная симуляция Cloudflare Workers
npm run dev:worker
```

Открой [http://localhost:3000](http://localhost:3000)

---

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────┐
│           NEXORUM OS Frontend               │
│         (React 19 + Tailwind CSS)           │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         REST API (Express / Worker)         │
│         /api/v1/*  →  API Router            │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│      BlockchainManager (Plugin Engine)      │
│  ┌─────────────┐  ┌─────────────┐          │
│  │  Ethereum   │  │   Solana    │  + ...   │
│  │   Plugin    │  │   Plugin    │          │
│  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────┘
```

---

## 📡 API Endpoints

| Method | Endpoint | Описание |
|--------|----------|----------|
| `GET` | `/api/v1/health` | Health check |
| `GET` | `/api/v1/networks` | Список сетей |
| `GET` | `/api/v1/rpc/status` | RPC benchmark |
| `POST` | `/api/v1/transactions/simulate` | Симуляция транзакции |
| `POST` | `/api/v1/tokens/create` | Создание токена |
| `GET` | `/api/v1/portfolio/:address` | Портфель |
| `GET` | `/api/v1/db/schema` | DDL схемы |

---

## 🛠️ Технологии

- **Frontend:** React 19, Tailwind CSS 4, Motion, Lucide Icons
- **Backend:** Express (dev) / Cloudflare Workers (prod)
- **Blockchain:** Ethers.js v6, Web3 APIs
- **AI:** Google GenAI (Gemini) — зависимость подключена, но AI-эндпоинты пока не реализованы (см. «Дальнейшие шаги»)
- **Database:** Cloudflare D1 (SQLite)

---

## 🧠 Live vs Simulated режим

Каждый сетевой плагин (`src/core/plugins/*`) при старте пытается подключиться к публичному RPC (Ethereum: `cloudflare-eth.com`, Solana: `api.mainnet-beta.solana.com`). Если соединение недоступно (нет интернета, RPC упал, таймаут), движок автоматически и без ошибок переключается в **simulated**-режим — детерминированные, но заведомо ненастоящие данные (баланс, блок, газ), подписанные `"mode": "simulated"` в каждом ответе API. Это позволяет разрабатывать и тестировать UI офлайн.

Чтобы использовать собственный RPC (Alchemy/Infura/QuickNode) — задайте `ETHEREUM_RPC_URL` в `.env` (см. `.env.example`).

---

## 🪙 Launchpad: реальный он-чейн деплой (Ethereum + Solana)

Launchpad деплоит настоящие токены — ERC-20 на Ethereum, SPL на Solana — прямо из кошелька пользователя. Приватный ключ никогда не покидает кошелёк и никогда не отправляется на сервер; сервер вообще не участвует в транзакции деплоя.

**Ethereum (MetaMask и любой EIP-1193-кошелёк).** Контракт — минимальный, стандартный ERC-20 без владельца и без функций mint/burn после деплоя (весь supply чеканится один раз получателю при создании). Исходник — `contracts/NexorumToken.sol`, скомпилированный артефакт (ABI + байткод) — `src/core/contracts/NexorumToken.json`. После правок контракта пересоберите артефакт:

```bash
npm run compile:contracts
```

**Solana (Phantom).** Создаёт настоящий SPL-mint через стандартные инструкции `@solana/spl-token` (`createAccount` → `initializeMint` → `createAssociatedTokenAccount` → `mintTo`), подписанные `signTransaction` кошелька и отправленные через выбранный в UI кластер — **Devnet** (тестовый SOL, по умолчанию) или **Mainnet Beta** (реальный SOL, отдельное предупреждение в интерфейсе). Логика в `src/lib/deploySolanaToken.ts` явно проверяет, что `supply × 10^decimals` помещается в 64-битное целое (SPL-суммы — `u64`, не `uint256`, как в Ethereum) — иначе понятная ошибка вместо тихого переполнения.

Обе цепочки показывают предупреждение в UI при работе с реальной сетью (mainnet Ethereum или Mainnet Beta Solana) — необратимо и стоит реальных денег; тестовые/dev-сети помечены отдельно.

Обе интеграции проверены end-to-end не только тайпчеком/сборкой, а реальными транзакциями на настоящем движке блокчейна — локальный EVM (ganache) для Ethereum и локальный Solana-раннер (`solana-bankrun`) для Solana — через настоящий UI с эмулированным кошельком, с последующим чтением состояния прямо из сети (`name()/symbol()/totalSupply()` для ERC-20; `decimals/supply/mintAuthority` для SPL) и сверкой с тем, что было введено в форму.

---

## ☁️ Деплой на Cloudflare Workers

```bash
# 1. Установить Wrangler CLI (уже в devDependencies) и авторизоваться
npx wrangler login

# 2. Создать D1-базу
npx wrangler d1 create nexorum-db
# Скопируйте выданный database_id

# 3. Скопировать конфиг и вставить свои значения
cp wrangler.toml.example wrangler.toml
# → впишите database_id из шага 2

# 4. Применить схему БД
npm run db:migrate:prod

# 5. (опционально) секреты — для будущих AI/RPC-функций
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put ETHEREUM_RPC_KEY
npx wrangler secret put SOLANA_RPC_KEY

# 6. Деплой
npm run deploy
```

`wrangler.toml` уже в `.gitignore` — секреты и `database_id` никогда не попадут в git.

---

## 🧭 Дальнейшие шаги

- Подключить `@google/genai` к реальному AI-аналитическому эндпоинту (сейчас зависимость установлена, но не используется).
- Писать в D1 (`transactions`, `tokens`, `portfolio_snapshots`) при реальных/симулированных транзакциях и токенах — сейчас схема создана, но не заполняется автоматически.
- Верификация исходного кода контракта на Etherscan/Sourcify после деплоя (сейчас контракт задеплоен, но не верифицирован автоматически).

---

## 📄 Лицензия

[MIT](LICENSE) © NEXORUM OS
