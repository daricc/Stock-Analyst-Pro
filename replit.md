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
- **Search screen**: Search any stock by ticker/name, shows popular stocks
- **Stock detail screen**: Real-time price, change, volume, 52-week range, interactive price chart (1D/5D/1M/3M/6M/1Y), key stats
- **AI Analysis**: Press "Run AI Analysis" to get GPT-5.2 powered analysis with:
  - Buy/Hold/Sell recommendation with confidence score
  - Technical & fundamental signals
  - Price targets (bear/base/bull scenarios)
  - Key risks and catalysts
- **Watchlist**: Save stocks and track them with live prices

## API Routes

- `GET /api/healthz` — Health check
- `GET /api/stocks/quote?symbol=AAPL` — Real-time stock quote
- `GET /api/stocks/history?symbol=AAPL&period=1mo` — Historical price data
- `GET /api/stocks/search?q=tesla` — Stock search
- `POST /api/stocks/analyze` — AI-powered stock analysis

Data sourced from Yahoo Finance (no API key needed). AI analysis uses OpenAI gpt-5.2 via Replit AI Integrations.

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/mobile` (`@workspace/mobile`)

Expo React Native mobile app for stock analysis. Uses file-based routing (Expo Router).

- Entry: `app/_layout.tsx` — root layout with providers
- Tabs: `app/(tabs)/index.tsx` (Search), `app/(tabs)/watchlist.tsx` (Watchlist)
- Detail: `app/stock/[symbol].tsx` — stock detail + AI analysis
- Context: `contexts/watchlist-context.tsx` — watchlist state with AsyncStorage
- Colors: `constants/colors.ts` — dark navy + emerald green theme

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server.

- Routes: `src/routes/stocks.ts` — stock data from Yahoo Finance + AI analysis via OpenAI
- Depends on: `@workspace/db`, `@workspace/api-zod`, `@workspace/integrations-openai-ai-server`

### `lib/integrations-openai-ai-server` (`@workspace/integrations-openai-ai-server`)

OpenAI SDK client configured via Replit AI Integrations. Uses `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` env vars.
