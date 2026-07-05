import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTrip, issuerPointsForTransfer } from '../src/engine/valuation.js';

const VALUATIONS = [
  { currency: 'chase_ur', displayName: 'Chase Ultimate Rewards', baselineCpp: 2.05, cashbackCpp: 1.0, portalCpp: 1.25 },
  { currency: 'amex_mr', displayName: 'Amex Membership Rewards', baselineCpp: 2.0, cashbackCpp: 0.6, portalCpp: 1.0 },
];

const PARTNERS = [
  { id: 1, currency: 'amex_mr', partnerName: 'ANA Mileage Club', ratioFrom: 1, ratioTo: 1, bonusPct: 0, transferIncrement: 1000 },
  { id: 2, currency: 'chase_ur', partnerName: 'World of Hyatt', ratioFrom: 1, ratioTo: 1, bonusPct: 0, transferIncrement: 1000 },
  { id: 3, currency: 'amex_mr', partnerName: 'Virgin Atlantic Flying Club', ratioFrom: 1, ratioTo: 1, bonusPct: 30, transferIncrement: 1000 },
  { id: 4, currency: 'amex_mr', partnerName: 'Hilton Honors', ratioFrom: 1, ratioTo: 2, bonusPct: 0, transferIncrement: 1000 },
];

test('issuerPointsForTransfer: 1:1 ratio rounds up to transfer increment', () => {
  const partner = PARTNERS[0];
  assert.equal(issuerPointsForTransfer(75000, partner), 75000);
  assert.equal(issuerPointsForTransfer(75500, partner), 76000);
  assert.equal(issuerPointsForTransfer(1, partner), 1000);
});

test('issuerPointsForTransfer: transfer bonus reduces issuer points needed', () => {
  // 30% bonus: each issuer point yields 1.3 partner points.
  // 65,000 / 1.3 = 50,000 exactly.
  assert.equal(issuerPointsForTransfer(65000, PARTNERS[2]), 50000);
});

test('issuerPointsForTransfer: 1:2 ratio halves issuer points needed', () => {
  assert.equal(issuerPointsForTransfer(80000, PARTNERS[3]), 40000);
});

test('portal and cashback options use fixed-value cpp', () => {
  const { options } = evaluateTrip({
    trip: { cashPrice: 1000 },
    balances: [{ currency: 'chase_ur', balance: 200000 }],
    valuations: [VALUATIONS[0]],
    partners: [],
    quotes: [],
  });
  const portal = options.find((o) => o.kind === 'portal');
  const cashback = options.find((o) => o.kind === 'cashback');
  assert.equal(portal.pointsUsed, 80000); // $1000 / 1.25cpp
  assert.equal(portal.cpp, 1.25);
  assert.equal(portal.feasible, true);
  assert.equal(cashback.pointsUsed, 100000); // $1000 / 1.0cpp
  assert.equal(cashback.cpp, 1.0);
});

test('transfer option computes implied cpp net of taxes/fees', () => {
  const { options } = evaluateTrip({
    trip: { cashPrice: 6500 },
    balances: [{ currency: 'amex_mr', balance: 120000 }],
    valuations: [VALUATIONS[1]],
    partners: PARTNERS,
    quotes: [{ id: 10, partnerId: 1, pointsRequired: 75000, taxesFees: 500 }],
  });
  const transfer = options.find((o) => o.kind === 'transfer');
  assert.equal(transfer.pointsUsed, 75000);
  assert.equal(transfer.outOfPocket, 500);
  assert.equal(transfer.dollarValue, 6000);
  assert.equal(transfer.cpp, 8); // 600000 cents / 75000 points
  assert.equal(transfer.feasible, true);
});

test('options are ranked feasible-first, then by cpp descending', () => {
  const { options, recommendation } = evaluateTrip({
    trip: { cashPrice: 6500 },
    balances: [
      { currency: 'amex_mr', balance: 80000 },
      { currency: 'chase_ur', balance: 5000 },
    ],
    valuations: VALUATIONS,
    partners: PARTNERS,
    quotes: [{ id: 10, partnerId: 1, pointsRequired: 75000, taxesFees: 500 }],
  });
  // Transfer (8cpp, feasible) should win over everything.
  assert.equal(options[0].kind, 'transfer');
  assert.equal(recommendation.option.kind, 'transfer');
  // Every feasible option must come before every infeasible one.
  const firstInfeasible = options.findIndex((o) => !o.feasible);
  if (firstInfeasible !== -1) {
    assert.ok(options.slice(firstInfeasible).every((o) => !o.feasible));
  }
  // cpp is descending within the feasible block.
  const feasible = options.filter((o) => o.feasible);
  for (let i = 1; i < feasible.length; i++) {
    assert.ok(feasible[i - 1].cpp >= feasible[i].cpp);
  }
});

test('insufficient balance marks option infeasible with shortfall', () => {
  const { options } = evaluateTrip({
    trip: { cashPrice: 6500 },
    balances: [{ currency: 'amex_mr', balance: 50000 }],
    valuations: [VALUATIONS[1]],
    partners: PARTNERS,
    quotes: [{ id: 10, partnerId: 1, pointsRequired: 75000, taxesFees: 500 }],
  });
  const transfer = options.find((o) => o.kind === 'transfer');
  assert.equal(transfer.feasible, false);
  assert.equal(transfer.shortfall, 25000);
});

test('recommendation warns when best cpp is below the baseline valuation', () => {
  const { recommendation } = evaluateTrip({
    trip: { cashPrice: 500 },
    balances: [{ currency: 'chase_ur', balance: 100000 }],
    valuations: [VALUATIONS[0]],
    partners: [],
    quotes: [],
  });
  // Best feasible is the portal at 1.25cpp, below the 2.05 baseline.
  assert.equal(recommendation.option.kind, 'portal');
  assert.match(recommendation.text, /below the .* baseline valuation/);
});

test('no cash price yields empty options and a prompt message', () => {
  const result = evaluateTrip({
    trip: { cashPrice: null },
    balances: [],
    valuations: VALUATIONS,
    partners: [],
    quotes: [],
  });
  assert.equal(result.options.length, 0);
  assert.equal(result.recommendation, null);
  assert.match(result.message, /cash price/i);
});

test('no affordable option still returns the ranked list with a warning', () => {
  const { options, recommendation } = evaluateTrip({
    trip: { cashPrice: 10000 },
    balances: [{ currency: 'chase_ur', balance: 1000 }],
    valuations: [VALUATIONS[0]],
    partners: [],
    quotes: [],
  });
  assert.ok(options.length > 0);
  assert.equal(recommendation.option, null);
  assert.match(recommendation.text, /No option is currently affordable/);
});

test('PRD core story: Amex->ANA transfer beats portal and cashback', () => {
  // "Transfer 60,000 Amex MR to ANA for this business class award —
  //  worth 3.1c/point vs. 1.25c/point on the Amex portal"-style scenario.
  const { options, recommendation } = evaluateTrip({
    trip: { cashPrice: 1860, name: 'DEN -> Tokyo business' },
    balances: [
      { currency: 'amex_mr', balance: 120000 },
      { currency: 'chase_ur', balance: 85000 },
    ],
    valuations: VALUATIONS,
    partners: PARTNERS,
    quotes: [{ id: 1, partnerId: 1, pointsRequired: 60000, taxesFees: 0 }],
  });
  const best = recommendation.option;
  assert.equal(best.kind, 'transfer');
  assert.equal(best.partnerName, 'ANA Mileage Club');
  assert.equal(best.pointsUsed, 60000);
  assert.equal(best.cpp, 3.1);
  assert.match(recommendation.text, /Transfer 60,000 Amex Membership Rewards to ANA Mileage Club/);
  // The portal option for the same currency should be clearly worse.
  const amexPortal = options.find((o) => o.kind === 'portal' && o.currency === 'amex_mr');
  assert.ok(amexPortal.cpp < best.cpp);
});
