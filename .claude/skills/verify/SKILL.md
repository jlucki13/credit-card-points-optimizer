---
name: verify
description: Build, launch, and drive the Points Optimizer app to verify changes end-to-end.
---

# Verifying Points Optimizer

## Build & launch

```bash
npm install                      # workspaces: server + client
npm run build                    # builds client/dist (Vite)
DB_PATH=/tmp/verify.db PORT=3001 node server/src/index.js &
```

The server serves the built client at `http://localhost:3001/` and the API
under `/api/*`. Use a throwaway `DB_PATH` so verification never touches
`server/data/points.db`. The DB is created and seeded (3 currencies,
~30 transfer partners) on first boot.

## Flows worth driving

1. **Wallet**: fresh DB shows the stale-balance warning banner; saving a
   balance stamps "Updated today" and clears it.
2. **Core story**: set balances → Trips → new trip with a cash price →
   trip detail → add an award quote (partner + points + taxes) →
   Recommendation card ranks the transfer first with ¢/point → "Log
   redemption" (accept the `confirm()` dialog) → History shows summary
   stats and the Wallet balance is deducted.
3. **Settings**: edit a transfer bonus % and re-check a trip's
   recommendation — the issuer points needed should drop.

## Driving the UI

Chromium is at `/opt/pw-browsers/chromium`; use `playwright-core` with
`executablePath`. Gotchas:

- Placeholder lookups need `{ exact: true }` ("DEN" substring-matches the
  trip-name placeholder).
- Trip detail has two tables — scope row selectors to
  `.card:has-text("Recommendation")` or the quotes card.
- "Log redemption" fires a native `confirm()`; register `page.once('dialog', ...)`
  before clicking.

## API smoke (fallback)

`curl http://localhost:3001/api/balances` returns the 3 seeded currencies.
`server/test/api.test.js` documents the full REST flow if you need request
shapes.
