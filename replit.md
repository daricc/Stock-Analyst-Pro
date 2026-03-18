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
- **Payments (Mobile)**: RevenueCat (iOS App Store + Google Play + Test Store)
- **Auth**: Replit Auth (OIDC/PKCE) via expo-auth-session

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   ├── mobile/             # Expo React Native app (Stock Analyzer)
│   └── mockup-sandbox/     # Component preview server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── integrations-openai-ai-server/ # OpenAI integration helpers
├── scripts/                # Utility scripts (seedRevenueCat, etc.)
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
  - **Day Trades**: Algorithmically scored intraday trades with full playbook (VWAP, support/resistance, scaling, exit rules, position sizing, red flags) — **PREMIUM ONLY**
  - Trending Now: Major tech/market movers with real-time data
  - Top Gainers: Automatically detected top performers
  - Big Movers: High-volatility stocks
  - Crypto: Bitcoin, Ethereum, Solana, and altcoin analysis
  - Each pick includes: sentiment badge, AI insight, expandable profit strategy (entry/target/stop-loss/timeframe)
  - Profit strategies and day trade playbooks gated behind premium
- **Paper Trading**: Full paper trading system with $100K starting balance
  - Buy/Long, Sell, Short/Futures, Cover tabs
  - Live P&L tracking with 30s price refresh
  - Position cards with direction badges
  - Transaction history
- **Stock detail screen**: Real-time price, change, volume, 52-week range, interactive price chart (1D/5D/1M/3M/6M/1Y), key stats
- **AI Analysis**: GPT-5.2 powered analysis — **PREMIUM ONLY** — buy/hold/sell recommendation, confidence score, technical & fundamental signals, price targets, risks, catalysts, entry/exit strategies (standard, futures, short selling)
- **Watchlist**: Save stocks/crypto and track them with live prices
- **Profile**: Login/logout, subscription status, upgrade to Premium

## Freemium Model

**Free features:**
- Real-time stock/crypto quotes and charts
- Portfolio tracking with paper trading
- Watchlist management
- Basic stock discovery (browse cards, sentiment, AI summaries)
- Cloud sync of portfolio/watchlist (when logged in)

**Premium features (via RevenueCat IAP):**
- AI-powered stock analysis (GPT-5.2)
- Day trade playbooks with intraday technicals
- Profit strategies (entry/target/stop-loss)
- Entry & exit strategies on stock detail
- Unlimited recommendations

Premium is gated via `PremiumGate` component and `useSubscription` hook. RevenueCat handles subscriptions on iOS (App Store), Android (Play Store), and web (Test Store for development).

## Authentication

- **Server**: Replit Auth (OIDC) — sessions stored in PostgreSQL, auth middleware on Express
- **Mobile**: expo-auth-session with PKCE flow, tokens stored in expo-secure-store
- **Sync**: Portfolio and watchlist sync to server when authenticated (2s debounce)

## RevenueCat Integration

- **Project**: Stock Analyzer (projbe0ce7a1)
- **Entitlement**: `premium`
- **Products**:
  - `premium_monthly` ($9.99/mo) — 7-day free trial
  - `premium_6month` ($49.99/6mo) — 7-day free trial
  - `premium_annual` ($79.99/yr) — 7-day free trial, best value
- **API Keys**: Stored as `EXPO_PUBLIC_REVENUECAT_*` env vars
- **Client**: `lib/revenuecat.tsx` — SubscriptionProvider wraps entire app
- **Seed script**: `scripts/src/seedRevenueCat.ts`
- **Bundle ID (iOS)**: com.stockanalyzer.app
- **Package Name (Android)**: com.stockanalyzer.app

## Day Trade Analysis Engine

The day trade system uses a multi-layer approach:
1. **Algorithmic Scoring**: Every ticker scored on intraday range %, gap %, change %, volume ratio, candle range, momentum — top 5 scored symbols get full technical analysis
2. **Intraday Technicals**: 5-min candle data from Yahoo Finance computes VWAP, support/resistance, relative volume, momentum score, price vs VWAP position, intraday trend direction
3. **AI Playbook Generation**: GPT-5.2 receives the computed technicals and generates a 7-step playbook: setup, entry trigger, scaling plan, profit targets, stop placement, exit rules, position sizing + red flags
4. **Frontend Display**: Orange-themed day trade cards with "INTRADAY — CLOSE BY END OF DAY" banner, technicals grid (VWAP/support/resistance/volume/momentum/trend), numbered step-by-step playbook, red flags section

## API Routes

- `GET /api/healthz` — Health check
- `GET /api/stocks/quote?symbol=AAPL` — Real-time stock/crypto quote
- `GET /api/stocks/history?symbol=AAPL&period=1mo` — Historical price data
- `GET /api/stocks/search?q=tesla` — Stock/crypto search
- `POST /api/stocks/analyze` — AI-powered stock analysis (premium)
- `GET /api/stocks/discover` — AI-curated discovery with day trade playbooks
- `GET /api/auth/user` — Get authenticated user info
- `GET /api/login` — OIDC login redirect
- `GET /api/callback` — OIDC callback
- `PUT /api/user-data/portfolio` — Save portfolio (authenticated)
- `GET /api/user-data/portfolio` — Load portfolio (authenticated)
- `PUT /api/user-data/watchlist` — Save watchlist (authenticated)
- `GET /api/user-data/watchlist` — Load watchlist (authenticated)
- `GET /api/stripe/premium-status` — Check premium status
- `POST /api/stripe/checkout` — Create checkout session

Data sourced from Yahoo Finance v8 chart API (no API key needed). AI analysis uses OpenAI gpt-5.2 via Replit AI Integrations.

## Caching Strategy

- **Discover cache**: 8-min TTL, warmed on server startup (3s delay), includes intraday technical analysis
- **Per-symbol quote cache**: 60s TTL in `singleQuoteCache` Map
- **Client-side**: Discover query staleTime 8min, gcTime 15min, refetchOnMount false; Portfolio prices refetch every 30s
- **Global QueryClient**: refetchOnWindowFocus false, refetchOnReconnect false, retry 1

## Crypto Format

Crypto symbols use `-USD` suffix: `BTC-USD`, `ETH-USD`, `SOL-USD`. Detection via `sym.includes("-USD")`. Display strips the suffix.

## Design Tokens

- Background: `#0A0F1E` (dark navy)
- Accent: `#00D084` (emerald green)
- Day Trade: `#FF9500` (orange)
- Premium/Gold: `#FFD700`
- Crypto badge: `#A78BFA` (purple)
- Bearish: `#FF4D6A` (red)
- Primary text: hardcoded `#FFFFFF`
- Card: `#111827`

## iOS Configuration

- Bundle ID: `com.stockanalyzer.app`
- Scheme: `stockanalyzer`
- UI Style: dark
- Splash background: `#0A0F1E`
- Non-exempt encryption: false
- Supports tablet: false

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Key Packages

### `artifacts/mobile` (`@workspace/mobile`)

Expo React Native mobile app for stock analysis. Uses file-based routing (Expo Router).

- Entry: `app/_layout.tsx` — root layout with providers (QueryClient, AuthProvider, SubscriptionProvider, WatchlistProvider, PortfolioProvider)
- Tabs: `app/(tabs)/index.tsx` (Search), `app/(tabs)/discover.tsx` (Discover), `app/(tabs)/portfolio.tsx` (Portfolio), `app/(tabs)/watchlist.tsx` (Watchlist), `app/(tabs)/profile.tsx` (Profile)
- Detail: `app/stock/[symbol].tsx` — stock detail + AI analysis (premium gated)
- Context: `contexts/watchlist-context.tsx` — watchlist state with AsyncStorage + server sync
- Context: `contexts/portfolio-context.tsx` — paper trading portfolio with AsyncStorage + server sync
- Auth: `lib/auth.tsx` — Replit Auth OIDC/PKCE provider
- Subscriptions: `lib/revenuecat.tsx` — RevenueCat subscription provider
- Premium UI: `components/PremiumGate.tsx` — PremiumGate, PremiumBadge, PaywallModal
- Components: `components/TradeModal.tsx` — trade execution modal (Buy/Sell/Short/Cover)
- Colors: `constants/colors.ts` — dark navy + emerald green theme

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server.

- Routes: `src/routes/stocks.ts` — stock/crypto data + AI analysis + discovery
- Auth: `src/routes/auth.ts`, `src/lib/auth.ts`, `src/middlewares/authMiddleware.ts`
- User data: `src/routes/user-data.ts` — portfolio/watchlist persistence
- Stripe: `src/routes/stripe.ts` — premium status, checkout (server-side fallback)
- Depends on: `@workspace/db`, `@workspace/api-zod`, `@workspace/integrations-openai-ai-server`

### `lib/integrations-openai-ai-server` (`@workspace/integrations-openai-ai-server`)

OpenAI SDK client configured via Replit AI Integrations. Uses `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` env vars.

## Database Schema

- `sessions` — Express session storage
- `users` — User accounts (id, email, firstName, lastName, profileImageUrl, stripeCustomerId, stripeSubscriptionId)
- `user_portfolios` — Server-side portfolio data per user
- `user_watchlists` — Server-side watchlist data per user
