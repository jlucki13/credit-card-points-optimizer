import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../src/db.js';
import { createApp } from '../src/app.js';

// Boots the app on an in-memory DB and exercises the main flow end-to-end:
// set balances -> create trip -> add award quote -> get recommendation ->
// log the redemption -> check history summary.

async function startServer() {
  const db = createDb(':memory:');
  const app = createApp(db);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://localhost:${server.address().port}`;
  const api = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };
  return { server, api };
}

test('full flow: balances -> trip -> quote -> recommendation -> history', async (t) => {
  const { server, api } = await startServer();
  t.after(() => server.close());

  // Seeded currencies exist with zero balances.
  const balances = await api('GET', '/api/balances');
  assert.equal(balances.status, 200);
  assert.equal(balances.body.length, 3);

  // Set balances (PRD core story numbers).
  for (const [currency, balance] of [
    ['chase_ur', 85000],
    ['amex_mr', 120000],
    ['cap1_miles', 40000],
  ]) {
    const res = await api('PUT', `/api/balances/${currency}`, { balance });
    assert.equal(res.status, 200);
  }

  // Balance update stamps last_updated.
  const updated = await api('GET', '/api/balances');
  assert.ok(updated.body.every((b) => b.lastUpdated));

  // Create the trip.
  const trip = await api('POST', '/api/trips', {
    name: 'Denver -> Tokyo, business, October',
    origin: 'DEN',
    destination: 'TYO',
    tripType: 'flight',
    cabin: 'business',
    travelers: 2,
    cashPrice: 9300,
  });
  assert.equal(trip.status, 201);
  const tripId = trip.body.id;

  // Find the seeded Amex -> ANA partner and add an award quote.
  const partners = await api('GET', '/api/partners');
  const ana = partners.body.find((p) => p.currency === 'amex_mr' && p.partnerName.includes('ANA'));
  assert.ok(ana, 'seeded ANA partner exists');
  const quote = await api('POST', `/api/trips/${tripId}/quotes`, {
    partnerId: ana.id,
    pointsRequired: 120000,
    taxesFees: 350,
  });
  assert.equal(quote.status, 201);

  // Recommendation ranks the ANA transfer first.
  const rec = await api('GET', `/api/trips/${tripId}/recommendation`);
  assert.equal(rec.status, 200);
  assert.equal(rec.body.recommendation.option.kind, 'transfer');
  assert.equal(rec.body.recommendation.option.partnerName, ana.partnerName);
  assert.equal(rec.body.recommendation.option.pointsUsed, 120000);
  assert.ok(rec.body.recommendation.option.cpp > 7); // (9300-350)*100/120000 ≈ 7.46
  assert.ok(rec.body.options.length >= 7); // 3 currencies x portal+cashback + transfer

  // Log the redemption and deduct the balance.
  const logged = await api('POST', '/api/history', {
    currency: 'amex_mr',
    pointsUsed: 120000,
    cashValue: 8950,
    description: 'ANA business DEN-TYO x2',
    tripId,
    deductFromBalance: true,
  });
  assert.equal(logged.status, 201);
  assert.equal(logged.body.cpp, 7.46);

  const afterBalances = await api('GET', '/api/balances');
  assert.equal(afterBalances.body.find((b) => b.currency === 'amex_mr').balance, 0);

  const summary = await api('GET', '/api/history/summary');
  assert.equal(summary.body.redemptions, 1);
  assert.equal(summary.body.totalValue, 8950);
  assert.equal(summary.body.averageCpp, 7.46);
});

test('validation: rejects bad balance and unknown currency', async (t) => {
  const { server, api } = await startServer();
  t.after(() => server.close());

  assert.equal((await api('PUT', '/api/balances/chase_ur', { balance: -5 })).status, 400);
  assert.equal((await api('PUT', '/api/balances/chase_ur', { balance: 1.5 })).status, 400);
  assert.equal((await api('PUT', '/api/balances/monopoly_money', { balance: 100 })).status, 404);
});

test('trip recommendation without cash price returns prompt message', async (t) => {
  const { server, api } = await startServer();
  t.after(() => server.close());

  const trip = await api('POST', '/api/trips', { name: 'Someday: Lisbon' });
  const rec = await api('GET', `/api/trips/${trip.body.id}/recommendation`);
  assert.equal(rec.status, 200);
  assert.equal(rec.body.options.length, 0);
  assert.match(rec.body.message, /cash price/i);
});
