import { useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { WalletButton } from './components/wallet/WalletButton';
import { MarketList } from './components/market/MarketList';
import { MarketDetail } from './components/market/MarketDetail';
import { CreateMarketForm } from './components/market/CreateMarketForm';
import { AnalyticsPage } from './components/analytics/AnalyticsPage';
import { bootMarketQuestions } from './utils/marketQuestions';

function NavLink({ to, label }: { to: string; label: string }): React.JSX.Element {
    const location = useLocation();
    const isActive = location.pathname === to;

    return (
        <Link
            to={to}
            className={`text-sm font-medium transition-colors ${
                isActive ? 'text-[#f7931a]' : 'text-[#8888a0] hover:text-[#e4e4ec]'
            }`}
        >
            {label}
        </Link>
    );
}

export function App(): React.JSX.Element {
    useEffect(() => { void bootMarketQuestions(); }, []);

    return (
        <div className="min-h-screen">
            <header className="border-b border-[#2a2a3a] bg-[#0a0a0f]/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <Link to="/" className="flex items-center gap-2.5 no-underline">
                            <span className="text-2xl">&#x1f52e;</span>
                            <span className="text-xl font-bold text-[#f7931a]">OProphet</span>
                        </Link>
                        <nav className="flex items-center gap-5">
                            <NavLink to="/" label="Markets" />
                            <NavLink to="/create" label="Create" />
                            <NavLink to="/analytics" label="Analytics" />
                        </nav>
                    </div>
                    <WalletButton />
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

            <footer className="border-t border-[#2a2a3a] mt-20">
                <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-[#555]">
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
                    <h1 className="text-3xl font-bold text-[#e4e4ec]">Prediction Markets</h1>
                    <p className="text-[#8888a0] mt-1">Bet on outcomes. Earn from your predictions. All on Bitcoin L1.</p>
                </div>
                <Link
                    to="/create"
                    className="bg-[#f7931a] hover:bg-[#fbb040] text-black font-semibold px-5 py-2.5 rounded-xl transition-colors no-underline text-sm"
                >
                    + New Market
                </Link>
            </div>
            <MarketList />
        </div>
    );
}
