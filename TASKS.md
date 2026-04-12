# Kova — Implementation Tasks

## packages/web (kova-web)

### Setup & Config

- [x] Initialize shadcn/ui (`pnpm dlx shadcn@latest init`) and add base components (Button, Input, Card, Table, Dialog, Badge, Tabs, DropdownMenu, Sheet, Label, Select, Separator)
- [x] Configure Drizzle ORM connection with PostgreSQL/Supabase in `src/lib/db.ts`
- [x] Create `drizzle.config.ts` with schema path, migrations output, and dialect
- [x] Implement Drizzle schema in `drizzle/schema.ts` — tables: `user`, `session`, `account`, `verification` (BetterAuth), `api_keys`, `endpoints`, `transactions`
- [ ] Generate and run initial Drizzle migration (requires `DATABASE_URL` env var)
- [x] Configure BetterAuth in `src/lib/auth.ts` — email/password signup + login, session management
- [x] Create BetterAuth React client in `src/lib/auth-client.ts` — exports `signIn`, `signUp`, `signOut`, `useSession`
- [x] Wire BetterAuth API route handler in `src/app/api/auth/[...all]/route.ts`
- [x] Set up Stellar SDK helpers in `src/lib/stellar.ts` — balance queries, explorer URL builders, address validation

### Landing Page (marketing)

- [ ] Build Navbar component (`src/components/landing/Navbar.tsx`) — logo, nav links, "Get Started" CTA
- [ ] Build Hero section — headline, subheadline, code snippet preview, CTA button
- [ ] Build HowItWorks section — 3-step visual flow (Protect → Pay → Earn)
- [ ] Build RevenueModel section — pay-per-request value props, sub-cent pricing
- [ ] Build WhyStellar section — finality, fees, uptime, native stablecoins
- [ ] Build Footer component — docs, GitHub, dashboard links, "Built on Stellar" badge
- [ ] Wire marketing layout (`layout.tsx`) with Navbar + Footer
- [ ] Build Docs quick-start page (`docs/page.tsx`) — installation, usage snippets for both SDKs

### Dashboard — Layout & Auth

- [ ] Build Sidebar component (`src/components/dashboard/Sidebar.tsx`) — nav links to all dashboard pages
- [ ] Implement auth guard in dashboard `layout.tsx` — redirect unauthenticated users to login
- [ ] Build Login page (or modal) — email/password form, BetterAuth integration
- [ ] Build Signup page (or modal) — registration form, BetterAuth integration

### Dashboard — Overview Page

- [ ] Build stats cards — total revenue (all time + 30d), total transactions (all time + 30d)
- [ ] Build revenue line chart (Recharts, daily granularity, last 30 days)
- [ ] Build recent transactions table (last 10) with status badges
- [ ] Implement `GET /api/transactions?limit=10` for recent txs
- [ ] Implement overview stats API route (aggregate queries)

### Dashboard — Endpoints Page

- [ ] Build endpoints table — method, path, price, description, status (active/paused)
- [ ] Build add/edit endpoint dialog — form with method select, path input, price input, description, status toggle
- [ ] Build delete endpoint confirmation
- [ ] Implement `GET /api/endpoints` — list user's endpoints
- [ ] Implement `POST /api/endpoints` — create endpoint
- [ ] Implement `PUT /api/endpoints/[id]` — update endpoint
- [ ] Implement `DELETE /api/endpoints/[id]` — delete endpoint

### Dashboard — Transactions Page

- [ ] Build paginated transactions table — timestamp, endpoint, amount, payer address (truncated), tx hash (Stellar explorer link), status
- [ ] Build filter controls — date range picker, endpoint select, status filter
- [ ] Implement CSV export button
- [ ] Implement `GET /api/transactions` with pagination, filtering, and sorting

### Dashboard — API Keys Page

- [ ] Build API key generation UI — name input, generate button, show key once
- [ ] Build active keys table — prefix, name, created date, last used
- [ ] Build revoke key confirmation dialog
- [ ] Implement `POST /api/api-keys` — generate key (hash before storing, return raw once)
- [ ] Implement `GET /api/api-keys` — list active keys
- [ ] Implement `DELETE /api/api-keys/[id]` — revoke key

### Dashboard — Wallet Page

- [ ] Build Stellar address input — set payTo address with validation (G... format)
- [ ] Build balance display — fetch from Stellar network, show USDC balance
- [ ] Build Stellar explorer link for address
- [ ] Implement `GET /api/wallet` — get user's Stellar config
- [ ] Implement `POST /api/wallet` — set/update Stellar address

### Dashboard — Settings Page

- [ ] Build account settings form — email display, password change
- [ ] Implement settings API routes

---

## packages/facilitator (kova-facilitator)

### Server Setup

- [x] Implement Fastify server entry in `src/index.ts` — CORS, routes registration, port binding
- [x] Implement env-based config in `src/config.ts` — validate required env vars at startup

### Stellar Integration

- [x] Implement Stellar/Soroban RPC client in `src/stellar/client.ts` — configure per network (testnet/pubnet)
- [x] Implement token contract addresses in `src/stellar/tokens.ts` — USDC per network
- [x] Implement auth entry verification in `src/stellar/verify-auth.ts` — validate Soroban auth entries (correct contract, function, params, expiration)
- [x] Implement transaction submission in `src/stellar/submit-tx.ts` — build Soroban tx, fee-bump, submit, poll until confirmed

### Routes

- [x] Implement `GET /supported` in `src/routes/supported.ts` — return supported networks, schemes, assets
- [x] Implement `POST /verify` in `src/routes/verify.ts` — decode payload, validate auth entry, simulate via Soroban RPC
- [x] Implement `POST /settle` in `src/routes/settle.ts` — re-verify, build tx, submit to Stellar, return settlement receipt

### Fee & Types

- [x] Implement fee calculator in `src/fee/calculator.ts` — configurable %, minimum floor
- [x] Define shared types in `src/types.ts` — PaymentPayload, PaymentRequirements, SettlementReceipt, VerifyRequest/Response, SettleRequest/Response

### Infrastructure

- [x] Add rate limiting to facilitator endpoints
- [ ] Test full verify + settle flow on Stellar testnet
- [ ] Validate Dockerfile builds and runs correctly

---

## packages/sdk-server (@onkova/sdk-server)

### Types & Config

- [x] Define `KovaServerOptions` interface in `src/config.ts` — apiKey, facilitatorUrl, payTo, network, routes
- [x] Define `RouteConfig` interface — method, price, description
- [x] Define x402 types in `src/x402/types.ts` — PaymentPayload, PaymentRequirements, 402 response schema

### Core Logic

- [x] Implement price parser in `src/utils.ts` — convert `'$0.001'` to Stellar token units (7 decimals)
- [x] Implement route matcher in `src/utils.ts` — match incoming request (method + path) against configured routes
- [x] Implement 402 response builder in `src/x402/payment-required.ts` — build x402 V2 JSON body
- [x] Implement verify caller in `src/x402/verify.ts` — POST to facilitator `/verify`
- [x] Implement settle caller in `src/x402/settle.ts` — POST to facilitator `/settle` (fire-and-forget after response)

### Middleware

- [x] Implement Fastify plugin in `src/middleware/fastify.ts` — onRequest hook, intercept protected routes, check X-PAYMENT, return 402 or proceed
- [x] Implement Express middleware in `src/middleware/express.ts` — same logic for Express
- [x] Export `kovaPlugin` and `kovaMiddleware` from `src/index.ts`

### Build & Publish

- [x] Verify tsup build produces correct ESM output with types
- [x] Test with Fastify — register plugin, verify 402 returned for unpaid requests
- [x] Test with Express — use middleware, verify 402 returned for unpaid requests

---

## packages/sdk-client (@onkova/sdk-client)

### Types & Config

- [ ] Define `KovaClientOptions` interface — stellarSecret, network, maxPaymentPerRequest, maxPaymentPerMinute, budget
- [ ] Define `BudgetConfig` interface — maxPerRequest, maxPerHour, maxPerDay, onBudgetExceeded
- [ ] Define x402 client types in `src/x402/types.ts` — PaymentRequirements, PaymentPayload
- [ ] Define wallet types in `src/wallet/types.ts` — WalletConfig, SignedAuthEntry

### Wallet & Signing

- [ ] Implement Stellar wallet in `src/wallet/stellar.ts` — keypair from secret, Soroban auth entry signing
- [ ] Build Soroban auth entry: token.transfer(from, to, amount), set max_ledger (~12 ledgers), sign with keypair

### x402 Flow

- [ ] Implement 402 response parser in `src/x402/parse-402.ts` — extract scheme, network, price, payTo, asset, facilitator
- [ ] Implement payment payload builder in `src/x402/build-payment.ts` — encode signed auth entry as base64 PaymentPayload

### Client Class

- [ ] Implement `KovaClient` class in `src/client.ts`:
  - [ ] `fetch(url, options)` — standard fetch, detect 402, auto-pay, retry
  - [ ] `fetchAll(urls)` — batch requests with concurrent payments
  - [ ] `getSpending()` — return totalSpent, requestsCount, lastPayment
  - [ ] Budget enforcement — check limits before paying, throw `BudgetExceededError` if over
- [ ] Export `KovaClient` from `src/index.ts`

### Build & Publish

- [ ] Verify tsup build produces correct ESM output with types
- [ ] Test against a running sdk-server instance — verify full 402 → pay → success flow

---

## examples/

### weather-api

- [ ] Implement example Fastify server in `src/index.ts` — one `/api/weather` endpoint protected via `@onkova/sdk-server`
- [ ] Return mock weather data `{ weather: 'sunny', temp: 72 }` when paid

### agent-consumer

- [ ] Implement example agent script in `src/index.ts` — use `KovaClient` to call weather API, print response
- [ ] Show spending summary after request

### Demo Script

- [ ] Make `demo.sh` executable and test on Windows (Git Bash / WSL)
- [ ] Verify end-to-end flow: facilitator starts → weather API starts → agent pays → data returned

---

## Cross-Cutting

- [ ] Run `pnpm install` at root — verify all workspace packages resolve
- [ ] Run `pnpm build` — verify all packages compile
- [ ] Test end-to-end on Stellar testnet (facilitator + sdk-server + sdk-client + dashboard)
- [ ] Seed database with sample data for dashboard demo
