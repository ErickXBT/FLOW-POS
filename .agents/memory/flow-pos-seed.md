---
name: Flow POS seed approach
description: How to seed data for Flow POS — tsx not available in api-server, use psql directly
---

## Rule
Seed Flow POS database via `psql $DATABASE_URL` directly, not via tsx scripts from the api-server package.

**Why:** The api-server package doesn't have tsx installed. The scripts package requires `@workspace/db` added to its `dependencies` and `pnpm install --filter @workspace/scripts` run before tsx seed scripts work from there.

## How to apply
- For seeding: use `psql $DATABASE_URL -c "INSERT ..."` with pre-computed password hashes
- Password hash: `node -e "const c=require('crypto'); console.log(c.createHash('sha256').update(password+'flow-salt').digest('hex'))"`
- For scripts package seeding: add `"@workspace/db": "workspace:*"` to scripts/package.json dependencies first, then `pnpm install --filter @workspace/scripts`
- Seed accounts: admin@flow.com/admin123 (super_admin), owner@demo.com/owner123 (owner, Demo Kafe tenant)
