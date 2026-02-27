import { useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { WalletButton } from './components/wallet/WalletButton';
import { MarketList } from './components/market/MarketList';
import { MarketDetail } from './components/market/MarketDetail';
import { CreateMarketForm } from './components/market/CreateMarketForm';
import { AnalyticsPage } from './components/analytics/AnalyticsPage';
import { ThemeToggle } from './components/common/ThemeToggle';
import { bootMarketQuestions } from './utils/marketQuestions';
import { bootCoinList } from './utils/coinList';

function NavLink({ to, label }: { to: string; label: string }): React.JSX.Element {
    const location = useLocation();
    const isActive = location.pathname === to;

    return (
        <Link
            to={to}
            className={`text-sm font-medium transition-colors ${
                isActive ? 'text-[var(--color-btc-orange)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
        >
            {label}
        </Link>
    );
}

export function App(): React.JSX.Element {
    useEffect(() => { void bootMarketQuestions(); bootCoinList(); }, []);

    return (
        <div className="min-h-screen">
            <header className="border-b border-[var(--color-border)] bg-[var(--color-header-bg)] backdrop-blur-sm sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <Link to="/" className="flex items-center gap-2.5 no-underline">
                            <span className="text-2xl">&#x1f52e;</span>
                            <span className="text-xl font-bold text-[var(--color-btc-orange)]">OProphet</span>
                        </Link>
                        <nav className="flex items-center gap-5">
                            <NavLink to="/" label="Markets" />
                            <NavLink to="/create" label="Create" />
                            <NavLink to="/analytics" label="Analytics" />
                        </nav>
                    </div>
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <WalletButton />
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-8">
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/create" element={<CreateMarketForm />} />
                    <Route path="/market/:id" element={<MarketDetail />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                </Routes>
            </main>

            <footer className="border-t border-[var(--color-border)] mt-20">
                <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
                    OProphet — Bitcoin Prediction Market on OPNet L1
                </div>
            </footer>
        </div>
    );
}

function DashboardPage(): React.JSX.Element {
    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Prediction Markets</h1>
                    <p className="text-[var(--color-text-secondary)] mt-1">Bet on outcomes. Earn from your predictions. All on Bitcoin L1.</p>
                </div>
                <Link
                    to="/create"
                    className="bg-[var(--color-btc-orange)] hover:bg-[var(--color-btc-orange-light)] text-black font-semibold px-5 py-2.5 rounded-xl transition-colors no-underline text-sm"
                >
                    + New Market
                </Link>
            </div>
            <MarketList />
        </div>
    );
}
