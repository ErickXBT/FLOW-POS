# Flow POS

SaaS Multi-Tenant Point-of-Sale platform for restaurants, cafes, fashion stores, salons, and minimarkets. Indonesian language UI. Brand: blue (#1D4EF5)/white/black.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/flow-pos run dev` — run the frontend (port auto)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (artifacts/api-server)
- Frontend: React + Vite + Wouter + Recharts + Lucide (artifacts/flow-pos)
- DB: PostgreSQL + Drizzle ORM (lib/db)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in lib/api-spec/openapi.yaml)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source-of-truth for all API contracts
- `lib/db/src/schema/index.ts` — DB schema (Drizzle)
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks (do NOT edit manually)
- `artifacts/api-server/src/routes/` — all route handlers
- `artifacts/flow-pos/src/pages/` — all frontend pages
- `artifacts/flow-pos/src/hooks/use-auth.ts` — auth state (JWT stored in localStorage as `flow_token`)

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed React Query hooks
- JWT auth with `SESSION_SECRET` env var; token stored in localStorage key `flow_token`
- Password hashing: SHA-256 with salt `flow-salt` (simple, not bcrypt)
- Multi-tenant: every DB query filters by `tenant_id` from JWT claims
- Super admin role has `tenant_id = null` and sees all tenants via `/api/admin/*` routes
- Seed via psql: generate password hashes with `crypto.SHA-256(password + 'flow-salt')`

## Product

- **Super Admin** (`admin@flow.com` / `admin123`): manages all tenants, subscriptions, stats
- **Tenant Owner** (`owner@demo.com` / `owner123`): POS, products, categories, orders, customers, employees, inventory, reports, settings
- Multi-tenant SaaS: owners register → create tenant → subscribe → use POS
- Business types: restaurant, cafe, fashion, salon, minimarket

## Gotchas

- `tsx` is NOT available in api-server — seed DB via psql or use scripts package
- scripts package needs `@workspace/db` as a dependency to run seed scripts
- After adding scripts deps, run `pnpm install --filter @workspace/scripts` first
- Orval generates camelCase field names from the OpenAPI spec (not snake_case)
- `SalesReport.topProducts` and `byPaymentMethod` are optional — always use `?? []`
- `Tenant` type does NOT have `receiptFooter` field; it's only in `TenantUpdate`
- Run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec change

## User preferences

- Indonesian language UI throughout
- Blue (#1D4EF5) primary brand color
- Flow logo at `attached_assets/FLOW_LOGO_1780799864457.png`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
