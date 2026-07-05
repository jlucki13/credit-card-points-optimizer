import { useEffect, useState } from 'react';
import { api, fmtPoints, fmtDollars } from '../api.js';

export default function HistoryPage() {
  const [history, setHistory] = useState(null);
  const [summary, setSummary] = useState(null);
  const [balances, setBalances] = useState([]);
  const [form, setForm] = useState({ currency: '', pointsUsed: '', cashValue: '', description: '' });
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      const [h, s, b] = await Promise.all([
        api.get('/api/history'),
        api.get('/api/history/summary'),
        api.get('/api/balances'),
      ]);
      setHistory(h);
      setSummary(s);
      setBalances(b);
      setForm((f) => ({ ...f, currency: f.currency || b[0]?.currency || '' }));
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/api/history', {
        currency: form.currency,
        pointsUsed: parseInt(form.pointsUsed, 10),
        cashValue: parseFloat(form.cashValue),
        description: form.description || null,
      });
      setForm({ ...form, pointsUsed: '', cashValue: '', description: '' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this history entry?')) return;
    await api.del(`/api/history/${id}`);
    load();
  };

  if (!history || !summary) return <p className="muted">Loading…</p>;

  return (
    <section>
      <h2>Redemption history</h2>
      {error && <div className="banner error">{error}</div>}
      <div className="cards stats">
        <div className="card stat">
          <div className="muted">Total value extracted</div>
          <div className="big-number">{fmtDollars(summary.totalValue)}</div>
        </div>
        <div className="card stat">
          <div className="muted">Points redeemed</div>
          <div className="big-number">{fmtPoints(summary.totalPoints)}</div>
        </div>
        <div className="card stat">
          <div className="muted">Average ¢/point</div>
          <div className="big-number">{summary.averageCpp ?? '—'}</div>
        </div>
        <div className="card stat">
          <div className="muted">Redemptions</div>
          <div className="big-number">{summary.redemptions}</div>
        </div>
      </div>

      {history.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Currency</th>
              <th className="num">Points</th>
              <th className="num">Value</th>
              <th className="num">¢/point</th>
              <th>Description</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {history.map((r) => (
              <tr key={r.id}>
                <td>{r.redeemedAt}</td>
                <td>{r.currency}</td>
                <td className="num">{fmtPoints(r.pointsUsed)}</td>
                <td className="num">{fmtDollars(r.cashValue)}</td>
                <td className="num">{r.cpp.toFixed(2)}</td>
                <td>{r.description || ''}</td>
                <td>
                  <button className="link danger" onClick={() => remove(r.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">
          No redemptions logged yet. Log one from a trip&apos;s recommendation, or add one manually
          below.
        </p>
      )}

      <div className="card">
        <h3>Log a redemption manually</h3>
        <form className="row wrap" onSubmit={add}>
          <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            {balances.map((b) => (
              <option key={b.currency} value={b.currency}>
                {b.displayName}
              </option>
            ))}
          </select>
          <input
            required
            type="number"
            min="1"
            placeholder="Points used"
            value={form.pointsUsed}
            onChange={(e) => setForm({ ...form, pointsUsed: e.target.value })}
          />
          <input
            required
            type="number"
            min="0"
            step="0.01"
            placeholder="Cash value (USD)"
            value={form.cashValue}
            onChange={(e) => setForm({ ...form, cashValue: e.target.value })}
          />
          <input
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <button className="primary" type="submit">
            Add
          </button>
        </form>
      </div>
    </section>
  );
}
