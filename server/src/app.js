import express from 'express';
import { evaluateTrip } from './engine/valuation.js';

// ---- row mappers (snake_case DB -> camelCase API) ----

const mapValuation = (r) => ({
  currency: r.currency,
  displayName: r.display_name,
  baselineCpp: r.baseline_cpp,
  cashbackCpp: r.cashback_cpp,
  portalCpp: r.portal_cpp,
});

const mapBalance = (r) => ({
  currency: r.currency,
  displayName: r.display_name,
  balance: r.balance,
  lastUpdated: r.last_updated,
});

const mapPartner = (r) => ({
  id: r.id,
  currency: r.currency,
  partnerName: r.partner_name,
  partnerType: r.partner_type,
  ratioFrom: r.ratio_from,
  ratioTo: r.ratio_to,
  bonusPct: r.bonus_pct,
  transferIncrement: r.transfer_increment,
});

const mapTrip = (r) => ({
  id: r.id,
  name: r.name,
  origin: r.origin,
  destination: r.destination,
  startDate: r.start_date,
  endDate: r.end_date,
  tripType: r.trip_type,
  cabin: r.cabin,
  travelers: r.travelers,
  cashPrice: r.cash_price,
  notes: r.notes,
  createdAt: r.created_at,
});

const mapQuote = (r) => ({
  id: r.id,
  tripId: r.trip_id,
  partnerId: r.partner_id,
  pointsRequired: r.points_required,
  taxesFees: r.taxes_fees,
  note: r.note,
});

const mapRedemption = (r) => ({
  id: r.id,
  redeemedAt: r.redeemed_at,
  currency: r.currency,
  pointsUsed: r.points_used,
  cashValue: r.cash_value,
  cpp: r.cpp,
  description: r.description,
  tripId: r.trip_id,
});

function loadEngineInputs(db, tripId) {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  if (!trip) return null;
  return {
    trip: mapTrip(trip),
    balances: db.prepare('SELECT * FROM point_balances').all(),
    valuations: db.prepare('SELECT * FROM valuation_config').all().map(mapValuation),
    partners: db.prepare('SELECT * FROM transfer_partners').all().map(mapPartner),
    quotes: db.prepare('SELECT * FROM award_quotes WHERE trip_id = ?').all(tripId).map(mapQuote),
  };
}

export function createApp(db) {
  const app = express();
  app.use(express.json());

  // ---- balances ----

  app.get('/api/balances', (req, res) => {
    const rows = db
      .prepare(
        `SELECT b.currency, b.balance, b.last_updated, v.display_name
         FROM point_balances b JOIN valuation_config v ON v.currency = b.currency`
      )
      .all();
    res.json(rows.map(mapBalance));
  });

  app.put('/api/balances/:currency', (req, res) => {
    const { balance } = req.body;
    if (!Number.isInteger(balance) || balance < 0) {
      return res.status(400).json({ error: 'balance must be a non-negative integer' });
    }
    const result = db
      .prepare(`UPDATE point_balances SET balance = ?, last_updated = datetime('now') WHERE currency = ?`)
      .run(balance, req.params.currency);
    if (result.changes === 0) return res.status(404).json({ error: 'unknown currency' });
    res.json({ ok: true });
  });

  // ---- valuation config ----

  app.get('/api/valuations', (req, res) => {
    res.json(db.prepare('SELECT * FROM valuation_config').all().map(mapValuation));
  });

  app.put('/api/valuations/:currency', (req, res) => {
    const { baselineCpp, cashbackCpp, portalCpp } = req.body;
    for (const [name, v] of Object.entries({ baselineCpp, cashbackCpp, portalCpp })) {
      if (typeof v !== 'number' || v < 0) {
        return res.status(400).json({ error: `${name} must be a non-negative number` });
      }
    }
    const result = db
      .prepare(
        `UPDATE valuation_config SET baseline_cpp = ?, cashback_cpp = ?, portal_cpp = ? WHERE currency = ?`
      )
      .run(baselineCpp, cashbackCpp, portalCpp, req.params.currency);
    if (result.changes === 0) return res.status(404).json({ error: 'unknown currency' });
    res.json({ ok: true });
  });

  // ---- transfer partners ----

  app.get('/api/partners', (req, res) => {
    res.json(
      db.prepare('SELECT * FROM transfer_partners ORDER BY currency, partner_name').all().map(mapPartner)
    );
  });

  app.post('/api/partners', (req, res) => {
    const { currency, partnerName, partnerType = 'airline', ratioFrom = 1, ratioTo = 1, bonusPct = 0, transferIncrement = 1000 } = req.body;
    if (!currency || !partnerName) {
      return res.status(400).json({ error: 'currency and partnerName are required' });
    }
    try {
      const result = db
        .prepare(
          `INSERT INTO transfer_partners (currency, partner_name, partner_type, ratio_from, ratio_to, bonus_pct, transfer_increment)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(currency, partnerName, partnerType, ratioFrom, ratioTo, bonusPct, transferIncrement);
      res.status(201).json({ id: result.lastInsertRowid });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put('/api/partners/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM transfer_partners WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'not found' });
    const p = { ...mapPartner(existing), ...req.body };
    db.prepare(
      `UPDATE transfer_partners
       SET partner_name = ?, partner_type = ?, ratio_from = ?, ratio_to = ?, bonus_pct = ?, transfer_increment = ?
       WHERE id = ?`
    ).run(p.partnerName, p.partnerType, p.ratioFrom, p.ratioTo, p.bonusPct, p.transferIncrement, req.params.id);
    res.json({ ok: true });
  });

  app.delete('/api/partners/:id', (req, res) => {
    db.prepare('DELETE FROM transfer_partners WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ---- trips ----

  app.get('/api/trips', (req, res) => {
    res.json(db.prepare('SELECT * FROM trips ORDER BY created_at DESC').all().map(mapTrip));
  });

  app.get('/api/trips/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(mapTrip(row));
  });

  app.post('/api/trips', (req, res) => {
    const {
      name, origin = null, destination = null, startDate = null, endDate = null,
      tripType = 'flight', cabin = 'economy', travelers = 1, cashPrice = null, notes = null,
    } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const result = db
      .prepare(
        `INSERT INTO trips (name, origin, destination, start_date, end_date, trip_type, cabin, travelers, cash_price, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(name, origin, destination, startDate, endDate, tripType, cabin, travelers, cashPrice, notes);
    res.status(201).json({ id: result.lastInsertRowid });
  });

  app.put('/api/trips/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'not found' });
    const t = { ...mapTrip(existing), ...req.body };
    db.prepare(
      `UPDATE trips SET name = ?, origin = ?, destination = ?, start_date = ?, end_date = ?,
       trip_type = ?, cabin = ?, travelers = ?, cash_price = ?, notes = ? WHERE id = ?`
    ).run(
      t.name, t.origin, t.destination, t.startDate, t.endDate,
      t.tripType, t.cabin, t.travelers, t.cashPrice, t.notes, req.params.id
    );
    res.json({ ok: true });
  });

  app.delete('/api/trips/:id', (req, res) => {
    db.prepare('DELETE FROM trips WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ---- award quotes (transfer-partner pricing the user found) ----

  app.get('/api/trips/:id/quotes', (req, res) => {
    res.json(db.prepare('SELECT * FROM award_quotes WHERE trip_id = ?').all(req.params.id).map(mapQuote));
  });

  app.post('/api/trips/:id/quotes', (req, res) => {
    const { partnerId, pointsRequired, taxesFees = 0, note = null } = req.body;
    if (!partnerId || !Number.isInteger(pointsRequired) || pointsRequired <= 0) {
      return res.status(400).json({ error: 'partnerId and a positive integer pointsRequired are required' });
    }
    try {
      const result = db
        .prepare(
          `INSERT INTO award_quotes (trip_id, partner_id, points_required, taxes_fees, note) VALUES (?, ?, ?, ?, ?)`
        )
        .run(req.params.id, partnerId, pointsRequired, taxesFees, note);
      res.status(201).json({ id: result.lastInsertRowid });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete('/api/quotes/:id', (req, res) => {
    db.prepare('DELETE FROM award_quotes WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ---- recommendation ----

  app.get('/api/trips/:id/recommendation', (req, res) => {
    const inputs = loadEngineInputs(db, req.params.id);
    if (!inputs) return res.status(404).json({ error: 'not found' });
    res.json(evaluateTrip(inputs));
  });

  // ---- redemption history ----

  app.get('/api/history', (req, res) => {
    res.json(
      db.prepare('SELECT * FROM redemption_history ORDER BY redeemed_at DESC, id DESC').all().map(mapRedemption)
    );
  });

  app.get('/api/history/summary', (req, res) => {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS redemptions,
                COALESCE(SUM(points_used), 0) AS total_points,
                COALESCE(SUM(cash_value), 0) AS total_value
         FROM redemption_history`
      )
      .get();
    res.json({
      redemptions: row.redemptions,
      totalPoints: row.total_points,
      totalValue: Math.round(row.total_value * 100) / 100,
      averageCpp:
        row.total_points > 0 ? Math.round(((row.total_value * 100) / row.total_points) * 100) / 100 : null,
    });
  });

  app.post('/api/history', (req, res) => {
    const { currency, pointsUsed, cashValue, description = null, tripId = null, redeemedAt = null, deductFromBalance = false } = req.body;
    if (!currency || !Number.isInteger(pointsUsed) || pointsUsed <= 0 || typeof cashValue !== 'number' || cashValue < 0) {
      return res.status(400).json({ error: 'currency, positive integer pointsUsed, and non-negative cashValue are required' });
    }
    const cpp = Math.round(((cashValue * 100) / pointsUsed) * 100) / 100;
    const insert = db.prepare(
      `INSERT INTO redemption_history (redeemed_at, currency, points_used, cash_value, cpp, description, trip_id)
       VALUES (COALESCE(?, date('now')), ?, ?, ?, ?, ?, ?)`
    );
    const result = db.transaction(() => {
      const r = insert.run(redeemedAt, currency, pointsUsed, cashValue, cpp, description, tripId);
      if (deductFromBalance) {
        db.prepare(
          `UPDATE point_balances SET balance = MAX(balance - ?, 0), last_updated = datetime('now') WHERE currency = ?`
        ).run(pointsUsed, currency);
      }
      return r;
    })();
    res.status(201).json({ id: result.lastInsertRowid, cpp });
  });

  app.delete('/api/history/:id', (req, res) => {
    db.prepare('DELETE FROM redemption_history WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  return app;
}
