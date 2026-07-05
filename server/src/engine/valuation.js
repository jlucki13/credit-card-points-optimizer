/**
 * Valuation engine — pure functions, no I/O.
 *
 * Given a trip (with a known cash price), the user's point balances,
 * per-currency valuation config, transfer-partner reference data, and any
 * award quotes the user has found, produce a ranked list of redemption
 * options with dollar value and cents-per-point (cpp) for each, plus a
 * plain-language recommendation.
 *
 * All "cpp" figures are cents per point. Dollar amounts are USD floats.
 *
 * Shapes:
 *   trip:       { cashPrice, name?, destination? }
 *   balances:   [{ currency, balance }]
 *   valuations: [{ currency, displayName, baselineCpp, cashbackCpp, portalCpp }]
 *   partners:   [{ id, currency, partnerName, ratioFrom, ratioTo, bonusPct,
 *                  transferIncrement, partnerType }]
 *   quotes:     [{ id, partnerId, pointsRequired, taxesFees, note? }]
 */

function round2(n) {
  return Math.round(n * 100) / 100;
}

function fmtPoints(n) {
  return n.toLocaleString('en-US');
}

function fmtDollars(n) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/**
 * Issuer points needed to end up with `partnerPointsRequired` partner points,
 * honoring the transfer ratio, any active transfer bonus, and the issuer's
 * transfer increment (most issuers transfer in blocks of 1,000).
 */
export function issuerPointsForTransfer(partnerPointsRequired, partner) {
  const { ratioFrom, ratioTo, bonusPct = 0, transferIncrement = 1000 } = partner;
  if (partnerPointsRequired <= 0) return 0;
  // Each issuer point yields (ratioTo / ratioFrom) * (1 + bonus) partner points.
  const yieldPerPoint = (ratioTo / ratioFrom) * (1 + bonusPct / 100);
  const exact = partnerPointsRequired / yieldPerPoint;
  const increment = transferIncrement > 0 ? transferIncrement : 1;
  return Math.ceil(exact / increment) * increment;
}

function fixedValueOption(kind, cashPrice, valuation, balance) {
  const cpp = kind === 'portal' ? valuation.portalCpp : valuation.cashbackCpp;
  if (!cpp || cpp <= 0) return null;
  const pointsUsed = Math.ceil((cashPrice * 100) / cpp);
  const feasible = balance >= pointsUsed;
  return {
    kind,
    currency: valuation.currency,
    currencyName: valuation.displayName,
    label:
      kind === 'portal'
        ? `Book through the ${valuation.displayName} travel portal`
        : `Redeem ${valuation.displayName} as cash back / statement credit`,
    pointsUsed,
    outOfPocket: 0,
    dollarValue: round2(cashPrice),
    cpp: round2(cpp),
    feasible,
    shortfall: feasible ? 0 : pointsUsed - balance,
  };
}

function transferOption(quote, partner, valuation, balance, cashPrice) {
  const pointsUsed = issuerPointsForTransfer(quote.pointsRequired, partner);
  if (pointsUsed <= 0) return null;
  const taxesFees = quote.taxesFees || 0;
  const dollarValue = round2(cashPrice - taxesFees);
  const bonusNote = partner.bonusPct ? ` (${partner.bonusPct}% transfer bonus)` : '';
  return {
    kind: 'transfer',
    currency: partner.currency,
    currencyName: valuation ? valuation.displayName : partner.currency,
    label: `Transfer ${valuation ? valuation.displayName : partner.currency} to ${partner.partnerName}${bonusNote}`,
    partnerId: partner.id,
    partnerName: partner.partnerName,
    quoteId: quote.id,
    partnerPointsRequired: quote.pointsRequired,
    pointsUsed,
    outOfPocket: round2(taxesFees),
    dollarValue,
    cpp: pointsUsed > 0 ? round2((dollarValue * 100) / pointsUsed) : 0,
    feasible: balance >= pointsUsed,
    shortfall: balance >= pointsUsed ? 0 : pointsUsed - balance,
    note: quote.note || null,
  };
}

function buildRecommendationText(best, options, valuationByCurrency) {
  const alternatives = options.filter((o) => o !== best && o.feasible);
  const nextBest = alternatives[0];
  let text;
  if (best.kind === 'transfer') {
    text =
      `Transfer ${fmtPoints(best.pointsUsed)} ${best.currencyName} to ${best.partnerName} — ` +
      `covers this trip for ${fmtPoints(best.partnerPointsRequired)} partner points` +
      (best.outOfPocket > 0 ? ` + ${fmtDollars(best.outOfPocket)} in taxes/fees` : '') +
      `, worth ${best.cpp}¢/point`;
  } else if (best.kind === 'portal') {
    text = `Book through the ${best.currencyName} portal with ${fmtPoints(best.pointsUsed)} points at ${best.cpp}¢/point`;
  } else {
    text = `Redeem ${fmtPoints(best.pointsUsed)} ${best.currencyName} as cash back at ${best.cpp}¢/point`;
  }
  if (nextBest) {
    text += ` vs. ${nextBest.cpp}¢/point for the next-best option (${nextBest.label.toLowerCase()}).`;
  } else {
    text += '.';
  }
  const baseline = valuationByCurrency.get(best.currency)?.baselineCpp;
  if (baseline && best.cpp < baseline) {
    text +=
      ` Note: this is below the ${best.currencyName} baseline valuation of ${baseline}¢/point — ` +
      `consider paying cash and saving the points for a higher-value redemption.`;
  }
  return text;
}

/**
 * Main entry point. Returns { options, recommendation }.
 * `options` is sorted: feasible options by cpp descending, then infeasible
 * options by cpp descending.
 */
export function evaluateTrip({ trip, balances = [], valuations = [], partners = [], quotes = [] }) {
  const cashPrice = Number(trip?.cashPrice);
  if (!Number.isFinite(cashPrice) || cashPrice <= 0) {
    return {
      options: [],
      recommendation: null,
      message: 'Enter the cash price of this trip to compare redemption options.',
    };
  }

  const balanceByCurrency = new Map(balances.map((b) => [b.currency, b.balance]));
  const valuationByCurrency = new Map(valuations.map((v) => [v.currency, v]));
  const partnerById = new Map(partners.map((p) => [p.id, p]));

  const options = [];

  for (const valuation of valuations) {
    const balance = balanceByCurrency.get(valuation.currency) ?? 0;
    const portal = fixedValueOption('portal', cashPrice, valuation, balance);
    if (portal) options.push(portal);
    const cashback = fixedValueOption('cashback', cashPrice, valuation, balance);
    if (cashback) options.push(cashback);
  }

  for (const quote of quotes) {
    const partner = partnerById.get(quote.partnerId);
    if (!partner) continue;
    const valuation = valuationByCurrency.get(partner.currency);
    const balance = balanceByCurrency.get(partner.currency) ?? 0;
    const option = transferOption(quote, partner, valuation, balance, cashPrice);
    if (option) options.push(option);
  }

  options.sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    return b.cpp - a.cpp;
  });

  const best = options.find((o) => o.feasible) || null;
  const recommendation = best
    ? { option: best, text: buildRecommendationText(best, options, valuationByCurrency) }
    : {
        option: null,
        text: 'No option is currently affordable with your balances. The list below shows what each path would cost.',
      };

  return { options, recommendation };
}
