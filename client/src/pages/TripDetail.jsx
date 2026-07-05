import { useCallback, useEffect, useState } from 'react';
import { api, fmtPoints, fmtDollars } from '../api.js';

const KIND_LABEL = { transfer: 'Transfer', portal: 'Portal', cashback: 'Cash back' };

export default function TripDetail({ tripId, onBack }) {
  const [trip, setTrip] = useState(null);
  const [partners, setPartners] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [rec, setRec] = useState(null);
  const [cashDraft, setCashDraft] = useState('');
  const [quoteForm, setQuoteForm] = useState({ partnerId: '', pointsRequired: '', taxesFees: '', note: '' });
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [t, p, q, r] = await Promise.all([
        api.get(`/api/trips/${tripId}`),
        api.get('/api/partners'),
        api.get(`/api/trips/${tripId}/quotes`),
        api.get(`/api/trips/${tripId}/recommendation`),
      ]);
      setTrip(t);
      setPartners(p);
      setQuotes(q);
      setRec(r);
      setCashDraft(t.cashPrice != null ? String(t.cashPrice) : '');
    } catch (e) {
      setError(e.message);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveCashPrice = async () => {
    setError(null);
    try {
      await api.put(`/api/trips/${tripId}`, {
        cashPrice: cashDraft === '' ? null : parseFloat(cashDraft),
      });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const addQuote = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/api/trips/${tripId}/quotes`, {
        partnerId: parseInt(quoteForm.partnerId, 10),
        pointsRequired: parseInt(quoteForm.pointsRequired, 10),
        taxesFees: quoteForm.taxesFees === '' ? 0 : parseFloat(quoteForm.taxesFees),
        note: quoteForm.note || null,
      });
      setQuoteForm({ partnerId: '', pointsRequired: '', taxesFees: '', note: '' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeQuote = async (id) => {
    await api.del(`/api/quotes/${id}`);
    load();
  };

  const logRedemption = async (option) => {
    const value = option.dollarValue;
    if (
      !confirm(
        `Log this redemption?\n\n${option.label}\n${fmtPoints(option.pointsUsed)} points for ${fmtDollars(value)} of value (${option.cpp}¢/pt).\n\nYour ${option.currencyName} balance will be reduced by ${fmtPoints(option.pointsUsed)}.`
      )
    )
      return;
    setError(null);
    try {
      await api.post('/api/history', {
        currency: option.currency,
        pointsUsed: option.pointsUsed,
        cashValue: value,
        description: `${trip.name}: ${option.label}`,
        tripId,
        deductFromBalance: true,
      });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!trip) return <p className="muted">Loading…</p>;

  const partnerName = (id) => {
    const p = partners.find((x) => x.id === id);
    return p ? `${p.partnerName} (${p.currency})` : `partner #${id}`;
  };

  return (
    <section>
      <button className="link" onClick={onBack}>
        ← All trips
      </button>
      <h2>{trip.name}</h2>
      <div className="muted">
        {[trip.origin, trip.destination].filter(Boolean).join(' → ') || 'Route TBD'} ·{' '}
        {trip.tripType === 'both' ? 'flight + hotel' : trip.tripType} · {trip.cabin} · {trip.travelers}{' '}
        traveler{trip.travelers > 1 ? 's' : ''}
        {trip.startDate && ` · ${trip.startDate}${trip.endDate ? ` – ${trip.endDate}` : ''}`}
      </div>
      {error && <div className="banner error">{error}</div>}

      <div className="card">
        <h3>Cash price baseline</h3>
        <p className="muted">
          The total cash price you found for this trip (e.g. on Google Flights) — every points
          option is valued against it.
        </p>
        <div className="row">
          <input
            type="number"
            min="0"
            step="0.01"
            value={cashDraft}
            onChange={(e) => setCashDraft(e.target.value)}
            placeholder="Total USD"
          />
          <button className="primary" onClick={saveCashPrice}>
            Save
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Award quotes (transfer partners)</h3>
        <p className="muted">
          Found an award price on a partner program? Enter it here to compare transferring points
          against portal / cash-back redemptions. (Availability is assumed confirmed by you.)
        </p>
        {quotes.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Partner</th>
                <th className="num">Partner points</th>
                <th className="num">Taxes/fees</th>
                <th>Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id}>
                  <td>{partnerName(q.partnerId)}</td>
                  <td className="num">{fmtPoints(q.pointsRequired)}</td>
                  <td className="num">{fmtDollars(q.taxesFees)}</td>
                  <td>{q.note || ''}</td>
                  <td>
                    <button className="link danger" onClick={() => removeQuote(q.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form className="row wrap" onSubmit={addQuote}>
          <select
            required
            value={quoteForm.partnerId}
            onChange={(e) => setQuoteForm({ ...quoteForm, partnerId: e.target.value })}
          >
            <option value="">Select partner…</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.partnerName} — via {p.currency}
                {p.bonusPct ? ` (+${p.bonusPct}% bonus)` : ''}
              </option>
            ))}
          </select>
          <input
            required
            type="number"
            min="1"
            placeholder="Partner points required"
            value={quoteForm.pointsRequired}
            onChange={(e) => setQuoteForm({ ...quoteForm, pointsRequired: e.target.value })}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Taxes/fees (USD)"
            value={quoteForm.taxesFees}
            onChange={(e) => setQuoteForm({ ...quoteForm, taxesFees: e.target.value })}
          />
          <input
            placeholder="Note (e.g. ANA round-trip biz)"
            value={quoteForm.note}
            onChange={(e) => setQuoteForm({ ...quoteForm, note: e.target.value })}
          />
          <button className="primary" type="submit">
            Add quote
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Recommendation</h3>
        {rec?.message && <p className="muted">{rec.message}</p>}
        {rec?.recommendation && (
          <div className={rec.recommendation.option ? 'banner success' : 'banner warn'}>
            {rec.recommendation.text}
          </div>
        )}
        {rec?.options?.length > 0 && (
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Option</th>
                <th className="num">Points used</th>
                <th className="num">Out of pocket</th>
                <th className="num">Value</th>
                <th className="num">¢/point</th>
                <th>Affordable?</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rec.options.map((o, i) => (
                <tr key={i} className={o.feasible ? '' : 'dim'}>
                  <td>{o === rec.options[0] && o.feasible ? '⭐' : ''}</td>
                  <td>
                    <span className={`pill ${o.kind}`}>{KIND_LABEL[o.kind]}</span> {o.label}
                  </td>
                  <td className="num">{fmtPoints(o.pointsUsed)}</td>
                  <td className="num">{fmtDollars(o.outOfPocket)}</td>
                  <td className="num">{fmtDollars(o.dollarValue)}</td>
                  <td className="num">
                    <strong>{o.cpp.toFixed(2)}</strong>
                  </td>
                  <td>{o.feasible ? 'Yes' : `Short ${fmtPoints(o.shortfall)}`}</td>
                  <td>
                    {o.feasible && (
                      <button className="link" onClick={() => logRedemption(o)}>
                        Log redemption
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
