# Points Optimizer

Personal app that tracks credit card rewards balances across **Chase Ultimate
Rewards**, **Amex Membership Rewards**, and **Capital One Miles**, and
recommends the highest-value way to redeem them for a specific trip —
comparing cash-back, travel-portal, and transfer-partner redemptions in
cents-per-point terms.

Built per the PRD's **Option A**: balances are entered manually. The app
never logs into issuer portals, never stores issuer credentials, and does no
scraping — issuers treat rewards-portal scraping as a ToS violation, so it is
explicitly out of scope.

## How it works

1. **Wallet** — enter your current point balances. Each currency shows a
   "last updated" timestamp and the app nudges you when balances go stale
   (7+ days).
2. **Trips** — save trip goals (route, dates, cabin, travelers) with the cash
   price you found (e.g. on Google Flights). Cash price is the baseline every
   points option is valued against.
3. **Award quotes** — when you find an award price on a transfer partner
   (e.g. ANA wants 120,000 miles + $350 for the flight), record it on the
   trip. The app assumes you've confirmed availability yourself.
4. **Recommendation** — the valuation engine ranks every redemption path:
   - **Transfer**: implied ¢/point = (cash price − taxes/fees) ÷ issuer
     points needed, honoring transfer ratios, active transfer bonuses, and
     1,000-point transfer increments.
   - **Portal**: fixed-value booking through Chase Travel / Amex Travel /
     Capital One Travel at your card's portal rate.
   - **Cash back**: statement-credit value as the floor.

   Options you can't afford are shown with the shortfall. If the best option
   is below the currency's baseline valuation, the app tells you to consider
   paying cash instead.
5. **History** — log redemptions (optionally deducting the balance) and track
   cumulative dollar value and average ¢/point extracted over time.

All reference data — baseline/cash-back/portal ¢/point values, transfer
partners, ratios, and transfer bonuses — lives in editable database tables
(Settings tab), not code. Issuers change these every few months; update them
in the UI.

## Stack

- **Frontend:** React 18 + Vite (`client/`)
- **Backend:** Node.js + Express (`server/`)
- **Database:** SQLite via better-sqlite3 (`server/data/points.db`, created
  and seeded on first boot). Single-user, personal-scale; the schema
  (`users`-free for now) maps directly onto Postgres if this ever needs to
  be hosted multi-user.
- **Valuation engine:** standalone pure module
  (`server/src/engine/valuation.js`) with no I/O, unit-tested independently
  of the API.

## Running it

```bash
npm install        # installs both workspaces

# Development (API on :3001, Vite dev server on :5173 with /api proxy)
npm run dev

# Production-style (single process serves API + built client on :3001)
npm run build
npm start
```

## Tests

```bash
npm test
```

Covers the valuation engine (transfer ratios, bonuses, increments,
feasibility, ranking, the PRD core-story scenario) and an end-to-end API
flow (balances → trip → quote → recommendation → history) on an in-memory
database.

## Project layout

```
server/
  src/
    engine/valuation.js   # pure valuation engine (the core logic)
    seed-data.js          # default valuations + transfer partners (editable in-app after seeding)
    db.js                 # SQLite schema + seed
    app.js                # Express routes
    index.js              # entry point; serves client/dist if built
  test/                   # node:test suites
client/
  src/pages/              # Wallet, Trips, TripDetail, History, Settings
```

## Non-goals (v1)

Automated booking, issuer portal scraping/login, award-availability search,
and issuers beyond Chase/Amex/Capital One. See the PRD for the full list and
the v1.5 ideas (flight-price API for cash baselines, screenshot OCR for
balance entry).
