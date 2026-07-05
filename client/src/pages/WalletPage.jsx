import { useEffect, useState } from 'react';
import { api, fmtPoints, daysSince } from '../api.js';

const STALE_DAYS = 7;

export default function WalletPage() {
  const [balances, setBalances] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState(null);

  const load = () =>
    api
      .get('/api/balances')
      .then((rows) => {
        setBalances(rows);
        setDrafts(Object.fromEntries(rows.map((b) => [b.currency, String(b.balance)])));
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const save = async (currency) => {
    setError(null);
    try {
      await api.put(`/api/balances/${currency}`, { balance: parseInt(drafts[currency], 10) || 0 });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!balances) return <p className="muted">Loading…</p>;

  const staleCount = balances.filter(
    (b) => b.lastUpdated == null || daysSince(b.lastUpdated) >= STALE_DAYS
  ).length;

  return (
    <section>
      <h2>Point balances</h2>
      <p className="muted">
        Balances are entered manually — this app never logs into issuer portals. Update them after
        earning or redeeming.
      </p>
      {staleCount > 0 && (
        <div className="banner warn">
          {staleCount} balance{staleCount > 1 ? 's' : ''} haven&apos;t been updated in the last{' '}
          {STALE_DAYS} days (or ever). Check your issuer dashboards and refresh them.
        </div>
      )}
      {error && <div className="banner error">{error}</div>}
      <div className="cards">
        {balances.map((b) => {
          const days = daysSince(b.lastUpdated);
          const stale = b.lastUpdated == null || days >= STALE_DAYS;
          return (
            <div className="card" key={b.currency}>
              <h3>{b.displayName}</h3>
              <div className="big-number">{fmtPoints(b.balance)}</div>
              <div className={stale ? 'muted stale' : 'muted'}>
                {b.lastUpdated == null
                  ? 'Never updated'
                  : days === 0
                    ? 'Updated today'
                    : `Updated ${days} day${days === 1 ? '' : 's'} ago`}
                {stale && ' · stale'}
              </div>
              <div className="row">
                <input
                  type="number"
                  min="0"
                  value={drafts[b.currency] ?? ''}
                  onChange={(e) => setDrafts({ ...drafts, [b.currency]: e.target.value })}
                />
                <button className="primary" onClick={() => save(b.currency)}>
                  Save
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
