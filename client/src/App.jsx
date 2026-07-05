import { useState } from 'react';
import WalletPage from './pages/WalletPage.jsx';
import TripsPage from './pages/TripsPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

const TABS = [
  { id: 'wallet', label: 'Wallet' },
  { id: 'trips', label: 'Trips' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [tab, setTab] = useState('wallet');

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          Points Optimizer
          <span className="tagline">Chase UR · Amex MR · Capital One</span>
        </h1>
        <nav>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'tab active' : 'tab'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'wallet' && <WalletPage />}
        {tab === 'trips' && <TripsPage />}
        {tab === 'history' && <HistoryPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
