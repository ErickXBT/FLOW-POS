---
name: Flow POS auth
description: JWT auth details for Flow POS — token storage, password hashing, multi-tenant claims
---

## Rule
JWT is signed with `SESSION_SECRET` env var (fallback: `flow-pos-secret-key-2024`). Password hashing uses SHA-256 with salt `flow-salt`. Token stored in localStorage under key `flow_token`.

**Why:** Simple SHA-256 chosen for demo speed; SESSION_SECRET is a Replit secret. Token getter registered via `setAuthTokenGetter` in the Orval custom-fetch.ts.

## How to apply
- Super admin: `tenant_id = null` in JWT, routes `/api/admin/*`
- Tenant users: `tenant_id` set to their tenant in JWT, all data filtered by it
- To generate a password hash for psql seeding: `SHA256(password + 'flow-salt')`
- Multi-tenant isolation: every API route filters `WHERE tenant_id = req.user.tenantId`
