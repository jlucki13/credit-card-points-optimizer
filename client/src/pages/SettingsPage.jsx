import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function SettingsPage() {
  const [valuations, setValuations] = useState(null);
  const [partners, setPartners] = useState(null);
  const [partnerForm, setPartnerForm] = useState({
    currency: 'chase_ur',
    partnerName: '',
    partnerType: 'airline',
    ratioFrom: 1,
    ratioTo: 1,
  });
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);

  const load = async () => {
    try {
      const [v, p] = await Promise.all([api.get('/api/valuations'), api.get('/api/partners')]);
      setValuations(v);
      setPartners(p);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const flash = (msg) => {
    setSaved(msg);
    setTimeout(() => setSaved(null), 2000);
  };

  const setVal = (currency, field, value) =>
    setValuations(valuations.map((v) => (v.currency === currency ? { ...v, [field]: value } : v)));

  const saveValuation = async (v) => {
    setError(null);
    try {
      await api.put(`/api/valuations/${v.currency}`, {
        baselineCpp: parseFloat(v.baselineCpp),
        cashbackCpp: parseFloat(v.cashbackCpp),
        portalCpp: parseFloat(v.portalCpp),
      });
      flash(`${v.displayName} valuations saved`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const setPartner = (id, field, value) =>
    setPartners(partners.map((p) => (p.id === id ? { ...p, [field]: value } : p)));

  const savePartner = async (p) => {
    setError(null);
    try {
      await api.put(`/api/partners/${p.id}`, {
        partnerName: p.partnerName,
        partnerType: p.partnerType,
        ratioFrom: parseFloat(p.ratioFrom),
        ratioTo: parseFloat(p.ratioTo),
        bonusPct: parseFloat(p.bonusPct) || 0,
        transferIncrement: parseInt(p.transferIncrement, 10) || 1000,
      });
      flash(`${p.partnerName} saved`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const addPartner = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/api/partners', {
        ...partnerForm,
        ratioFrom: parseFloat(partnerForm.ratioFrom),
        ratioTo: parseFloat(partnerForm.ratioTo),
      });
      setPartnerForm({ ...partnerForm, partnerName: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removePartner = async (id) => {
    if (!confirm('Delete this transfer partner? Award quotes that use it will be deleted too.')) return;
    await api.del(`/api/partners/${id}`);
    load();
  };

  if (!valuations || !partners) return <p className="muted">Loading…</p>;

  return (
    <section>
      <h2>Settings</h2>
      {error && <div className="banner error">{error}</div>}
      {saved && <div className="banner success">{saved}</div>}

      <div className="card">
        <h3>Point valuations (¢/point)</h3>
        <p className="muted">
          Baseline = published estimate of what the currency is worth (e.g. The Points Guy).
          Cash-back and portal rates depend on which card you hold — adjust to yours. These shift
          over time; update them here, no code change needed.
        </p>
        <table>
          <thead>
            <tr>
              <th>Currency</th>
              <th className="num">Baseline</th>
              <th className="num">Cash back</th>
              <th className="num">Portal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {valuations.map((v) => (
              <tr key={v.currency}>
                <td>{v.displayName}</td>
                {['baselineCpp', 'cashbackCpp', 'portalCpp'].map((f) => (
                  <td className="num" key={f}>
                    <input
                      className="narrow"
                      type="number"
                      min="0"
                      step="0.01"
                      value={v[f]}
                      onChange={(e) => setVal(v.currency, f, e.target.value)}
                    />
                  </td>
                ))}
                <td>
                  <button className="link" onClick={() => saveValuation(v)}>
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Transfer partners</h3>
        <p className="muted">
          Ratio is issuer points : partner points. Enter an active transfer bonus as a percentage
          (e.g. 30 for a 30% bonus) and set it back to 0 when it ends.
        </p>
        <table>
          <thead>
            <tr>
              <th>Via</th>
              <th>Partner</th>
              <th>Type</th>
              <th className="num">Ratio</th>
              <th className="num">Bonus %</th>
              <th className="num">Increment</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p.id}>
                <td>{p.currency}</td>
                <td>{p.partnerName}</td>
                <td>{p.partnerType}</td>
                <td className="num nowrap">
                  <input
                    className="tiny"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={p.ratioFrom}
                    onChange={(e) => setPartner(p.id, 'ratioFrom', e.target.value)}
                  />
                  {' : '}
                  <input
                    className="tiny"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={p.ratioTo}
                    onChange={(e) => setPartner(p.id, 'ratioTo', e.target.value)}
                  />
                </td>
                <td className="num">
                  <input
                    className="tiny"
                    type="number"
                    min="0"
                    value={p.bonusPct}
                    onChange={(e) => setPartner(p.id, 'bonusPct', e.target.value)}
                  />
                </td>
                <td className="num">
                  <input
                    className="narrow"
                    type="number"
                    min="1"
                    value={p.transferIncrement}
                    onChange={(e) => setPartner(p.id, 'transferIncrement', e.target.value)}
                  />
                </td>
                <td>
                  <button className="link" onClick={() => savePartner(p)}>
                    Save
                  </button>
                </td>
                <td>
                  <button className="link danger" onClick={() => removePartner(p.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <h4>Add partner</h4>
        <form className="row wrap" onSubmit={addPartner}>
          <select
            value={partnerForm.currency}
            onChange={(e) => setPartnerForm({ ...partnerForm, currency: e.target.value })}
          >
            {valuations.map((v) => (
              <option key={v.currency} value={v.currency}>
                {v.displayName}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Partner name"
            value={partnerForm.partnerName}
            onChange={(e) => setPartnerForm({ ...partnerForm, partnerName: e.target.value })}
          />
          <select
            value={partnerForm.partnerType}
            onChange={(e) => setPartnerForm({ ...partnerForm, partnerType: e.target.value })}
          >
            <option value="airline">Airline</option>
            <option value="hotel">Hotel</option>
          </select>
          <input
            className="tiny"
            type="number"
            min="0.1"
            step="0.1"
            title="Ratio from (issuer points)"
            value={partnerForm.ratioFrom}
            onChange={(e) => setPartnerForm({ ...partnerForm, ratioFrom: e.target.value })}
          />
          <span>:</span>
          <input
            className="tiny"
            type="number"
            min="0.1"
            step="0.1"
            title="Ratio to (partner points)"
            value={partnerForm.ratioTo}
            onChange={(e) => setPartnerForm({ ...partnerForm, ratioTo: e.target.value })}
          />
          <button className="primary" type="submit">
            Add
          </button>
        </form>
      </div>
    </section>
  );
}
