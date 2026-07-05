import { useEffect, useState } from 'react';
import { api, fmtDollars } from '../api.js';
import TripDetail from './TripDetail.jsx';

const EMPTY_TRIP = {
  name: '',
  origin: '',
  destination: '',
  startDate: '',
  endDate: '',
  tripType: 'flight',
  cabin: 'economy',
  travelers: 1,
  cashPrice: '',
  notes: '',
};

export default function TripsPage() {
  const [trips, setTrips] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_TRIP);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);

  const load = () => api.get('/api/trips').then(setTrips).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const { id } = await api.post('/api/trips', {
        ...form,
        travelers: parseInt(form.travelers, 10) || 1,
        cashPrice: form.cashPrice === '' ? null : parseFloat(form.cashPrice),
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      });
      setForm(EMPTY_TRIP);
      setShowForm(false);
      await load();
      setSelectedId(id);
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this trip (and its award quotes)?')) return;
    await api.del(`/api/trips/${id}`);
    if (selectedId === id) setSelectedId(null);
    load();
  };

  if (selectedId != null) {
    return (
      <TripDetail
        tripId={selectedId}
        onBack={() => {
          setSelectedId(null);
          load();
        }}
      />
    );
  }

  if (!trips) return <p className="muted">Loading…</p>;

  return (
    <section>
      <div className="row space-between">
        <h2>Trip goals</h2>
        <button className="primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New trip'}
        </button>
      </div>
      {error && <div className="banner error">{error}</div>}

      {showForm && (
        <form className="card form-grid" onSubmit={create}>
          <label>
            Trip name*
            <input required value={form.name} onChange={set('name')} placeholder="Denver → Tokyo, October" />
          </label>
          <label>
            Origin
            <input value={form.origin} onChange={set('origin')} placeholder="DEN" />
          </label>
          <label>
            Destination
            <input value={form.destination} onChange={set('destination')} placeholder="TYO" />
          </label>
          <label>
            Start date
            <input type="date" value={form.startDate} onChange={set('startDate')} />
          </label>
          <label>
            End date
            <input type="date" value={form.endDate} onChange={set('endDate')} />
          </label>
          <label>
            Type
            <select value={form.tripType} onChange={set('tripType')}>
              <option value="flight">Flight</option>
              <option value="hotel">Hotel</option>
              <option value="both">Flight + hotel</option>
            </select>
          </label>
          <label>
            Cabin
            <select value={form.cabin} onChange={set('cabin')}>
              <option value="economy">Economy</option>
              <option value="premium">Premium economy</option>
              <option value="business">Business</option>
              <option value="first">First</option>
            </select>
          </label>
          <label>
            Travelers
            <input type="number" min="1" value={form.travelers} onChange={set('travelers')} />
          </label>
          <label>
            Cash price (total, USD)
            <input type="number" min="0" step="0.01" value={form.cashPrice} onChange={set('cashPrice')} placeholder="e.g. from Google Flights" />
          </label>
          <label className="full">
            Notes
            <input value={form.notes} onChange={set('notes')} />
          </label>
          <div className="full">
            <button className="primary" type="submit">
              Save trip
            </button>
          </div>
        </form>
      )}

      {trips.length === 0 && !showForm && (
        <p className="muted">
          No trips yet. Add a trip goal, enter the cash price you found, and get a redemption
          recommendation.
        </p>
      )}

      <div className="cards">
        {trips.map((t) => (
          <div className="card clickable" key={t.id} onClick={() => setSelectedId(t.id)}>
            <div className="row space-between">
              <h3>{t.name}</h3>
              <button
                className="link danger"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(t.id);
                }}
              >
                Delete
              </button>
            </div>
            <div className="muted">
              {[t.origin, t.destination].filter(Boolean).join(' → ') || 'Route TBD'} ·{' '}
              {t.tripType === 'both' ? 'flight + hotel' : t.tripType} · {t.cabin} · {t.travelers}{' '}
              traveler{t.travelers > 1 ? 's' : ''}
            </div>
            <div>
              Cash price: <strong>{t.cashPrice != null ? fmtDollars(t.cashPrice) : 'not set'}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
