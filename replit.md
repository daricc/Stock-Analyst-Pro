# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2)
- **Mobile**: Expo React Native (Expo Router)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── mobile/             # Expo React Native app (Stock Analyzer)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── integrations-openai-ai-server/ # OpenAI integration helpers
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Mobile App — Stock Analyzer

A polished dark-theme stock analysis mobile app with:
- **Search screen**: Search any stock/crypto by ticker/name, shows popular stocks + crypto (BTC, ETH, SOL)
- **Discover screen**: AI-powered multi-tier stock & crypto discovery engine
  - Market Pulse: Overall market mood assessment with trending themes
  - **Day Trades**: Algorithmically scored intraday trades with full playbook (VWAP, support/resistance, scaling, exit rules, position sizing, red flags)
  - Trending Now: Major tech/market movers with real-time data
  - Top Gainers: Automatically detected top performers
  - Big Movers: High-volatility stocks
  - Crypto: Bitcoin, Ethereum, Solana, and altcoin analysis
  - Each pick includes: sentiment badge, AI insight, expandable profit strategy (entry/target/stop-loss/timeframe)
  - Expected profit % and risk/reward ratio on every pick
- **Paper Trading**: Full paper trading system with $100K starting balance
  - Buy/Long, Sell, Short/Futures, Cover tabs
  - Live P&L tracking with 30s price refresh
  - Position cards with direction badges
  - Transaction history
- **Stock detail screen**: Real-time price, change, volume, 52-week range, interactive price chart (1D/5D/1M/3M/6M/1Y), key stats
- **AI Analysis**: GPT-5.2 powered analysis with buy/hold/sell recommendation, confidence score, technical & fundamental signals, price targets, risks, catalysts, entry/exit strategies (standard, futures, short selling)
- **Watchlist**: Save stocks/crypto and track them with live prices

## Day Trade Analysis Engine

The day trade system uses a multi-layer approach:
1. **Algorithmic Scoring**: Every ticker scored on intraday range %, gap %, change %, volume ratio, candle range, momentum — top 5 scored symbols get full technical analysis
2. **Intraday Technicals**: 5-min candle data from Yahoo Finance computes VWAP, support/resistance, relative volume, momentum score, price vs VWAP position, intraday trend direction
3. **AI Playbook Generation**: GPT-5.2 receives the computed technicals and generates a 7-step playbook: setup, entry trigger, scaling plan, profit targets, stop placement, exit rules, position sizing + red flags
4. **Frontend Display**: Orange-themed day trade cards with "INTRADAY — CLOSE BY END OF DAY" banner, technicals grid (VWAP/support/resistance/volume/momentum/trend), numbered step-by-step playbook, red flags section

## API Routes

- `GET /api/healthz` — Health check
- `GET /api/stocks/quote?symbol=AAPL` — Real-time stock/crypto quote (query param, NOT path param)
- `GET /api/stocks/history?symbol=AAPL&period=1mo` — Historical price data
- `GET /api/stocks/search?q=tesla` — Stock/crypto search (includes CRYPTOCURRENCY type)
- `POST /api/stocks/analyze` — AI-powered stock analysis with investment strategy param (standard/futures/short)
- `GET /api/stocks/discover` — AI-curated stock & crypto discovery with profit strategies, day trade playbooks (8-min server cache, warmed on startup)

Data sourced from Yahoo Finance v8 chart API (no API key needed). AI analysis uses OpenAI gpt-5.2 via Replit AI Integrations.

## Caching Strategy

- **Discover cache**: 8-min TTL, warmed on server startup (3s delay), includes intraday technical analysis
- **Per-symbol quote cache**: 60s TTL in `singleQuoteCache` Map, shared by quote endpoint and discover
- **Client-side**: Discover query staleTime 8min, gcTime 15min, refetchOnMount false; Portfolio prices refetch every 30s
- **Global QueryClient**: refetchOnWindowFocus false, refetchOnReconnect false, retry 1

## Crypto Format

Crypto symbols use `-USD` suffix: `BTC-USD`, `ETH-USD`, `SOL-USD`. Detection via `sym.includes("-USD")`. Display strips the suffix.

## Design Tokens

- Background: `#0A0F1E` (dark navy)
- Accent: `#00D084` (emerald green)
- Day Trade: `#FF9500` (orange)
- Crypto badge: `#A78BFA` (purple)
- Bearish: `#FF4D6A` (red)
- Primary text: hardcoded `#FFFFFF`
- Card: `#111827`

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/mobile` (`@workspace/mobile`)

Expo React Native mobile app for stock analysis. Uses file-based routing (Expo Router).

- Entry: `app/_layout.tsx` — root layout with providers (QueryClient with optimized defaults)
- Tabs: `app/(tabs)/index.tsx` (Search), `app/(tabs)/discover.tsx` (Discover), `app/(tabs)/portfolio.tsx` (Portfolio), `app/(tabs)/watchlist.tsx` (Watchlist)
- Detail: `app/stock/[symbol].tsx` — stock detail + AI analysis + Paper Trade button
- Context: `contexts/watchlist-context.tsx` — watchlist state with AsyncStorage
- Context: `contexts/portfolio-context.tsx` — paper trading portfolio with AsyncStorage ($100K starting balance)
- Components: `components/TradeModal.tsx` — trade execution modal (Buy/Sell/Short/Cover)
- Colors: `constants/colors.ts` — dark navy + emerald green theme

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server.

- Routes: `src/routes/stocks.ts` — stock/crypto data from Yahoo Finance + AI analysis & discovery with day trade playbooks + intraday technical analysis
- Key functions: `fetchIntradayCandles()`, `computeIntradayTechnicals()`, `generateDiscoverData()`
- Depends on: `@workspace/db`, `@workspace/api-zod`, `@workspace/integrations-openai-ai-server`

### `lib/integrations-openai-ai-server` (`@workspace/integrations-openai-ai-server`)

OpenAI SDK client configured via Replit AI Integrations. Uses `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` env vars.
