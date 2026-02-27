import { useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { WalletButton } from './components/wallet/WalletButton';
import { MarketList } from './components/market/MarketList';
import { MarketDetail } from './components/market/MarketDetail';
import { CreateMarketForm } from './components/market/CreateMarketForm';
import { AnalyticsPage } from './components/analytics/AnalyticsPage';
import { UserDashboard } from './components/dashboard/UserDashboard';
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
                            <NavLink to="/how-it-works" label="How It Works" />
                        </nav>
                    </div>
                    <div className="flex items-center gap-3">
                        <NavLink to="/dashboard" label="My Dashboard" />
                        <WalletButton />
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-8">
                <Routes>
                    <Route path="/" element={<MarketsPage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/create" element={<CreateMarketForm />} />
                    <Route path="/market/:id" element={<MarketDetail />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/how-it-works" element={<HowItWorksPage />} />
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

function MarketsPage(): React.JSX.Element {
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

function HowItWorksPage(): React.JSX.Element {
    const steps = [
        {
            title: '1. Connect Your Wallet',
            description: 'Install OP_WALLET and connect it to OProphet. Your wallet is your identity on the OPNet Bitcoin L1 network.',
        },
        {
            title: '2. Browse or Create Markets',
            description: 'Explore existing prediction markets or create your own. Each market poses a YES/NO question with a deadline (end block). The creator sets the oracle — the address responsible for resolving the outcome.',
        },
        {
            title: '3. Place Your Bets',
            description: 'Bet sats on YES or NO for any open market. Your bet is locked on-chain until the market is resolved. The odds shift as more sats flow into each side.',
        },
        {
            title: '4. Wait for Resolution',
            description: 'After the deadline passes, the designated oracle resolves the market by declaring the outcome (YES or NO). OPNet blocks are mined every ~10 minutes.',
        },
        {
            title: '5. Claim Your Winnings',
            description: 'If you bet on the winning side, claim your share of the total pool. Payouts are proportional to your bet relative to all winning bets.',
        },
    ];

    const faqs = [
        {
            q: 'What is OPNet?',
            a: 'OPNet is a Bitcoin Layer 1 smart contract platform. It enables on-chain logic directly on Bitcoin using Tapscript-encoded calldata — no sidechains, no bridges.',
        },
        {
            q: 'What currency do I bet with?',
            a: 'You bet with sats (satoshis) — the smallest unit of Bitcoin. 100,000,000 sats = 1 BTC.',
        },
        {
            q: 'How long do blocks take?',
            a: 'OPNet testnet blocks are mined approximately every 10 minutes. New markets, bets, and resolutions appear after the next block is confirmed.',
        },
        {
            q: 'What is an oracle?',
            a: 'The oracle is a wallet address designated to resolve a market. When the deadline passes, only the oracle can declare the outcome. By default, the market creator is the oracle.',
        },
        {
            q: 'How are winnings calculated?',
            a: 'The total pool (all YES + NO bets) is distributed to winners proportionally. If you bet 1,000 sats YES and the total YES pool is 10,000 sats, you receive 10% of the entire pool.',
        },
        {
            q: 'What happens if I bet on the losing side?',
            a: 'Your sats go to the winners. There is no refund for losing bets — that\'s the risk and reward of prediction markets.',
        },
        {
            q: 'Can I cancel a bet?',
            a: 'No. Once a bet is confirmed on-chain, it cannot be reversed. Make sure you\'re confident before placing a bet.',
        },
    ];

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">How It Works</h1>
                <p className="text-[var(--color-text-secondary)] mt-1">Everything you need to know about OProphet prediction markets.</p>
            </div>

            {/* Steps */}
            <div className="space-y-4 mb-12">
                {steps.map((step) => (
                    <div
                        key={step.title}
                        className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6"
                    >
                        <h3 className="text-lg font-semibold text-[var(--color-btc-orange)] mb-2">{step.title}</h3>
                        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{step.description}</p>
                    </div>
                ))}
            </div>

            {/* FAQ */}
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">FAQ</h2>
                <div className="space-y-3">
                    {faqs.map((faq) => (
                        <div
                            key={faq.q}
                            className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6"
                        >
                            <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">{faq.q}</h4>
                            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{faq.a}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function DashboardPage(): React.JSX.Element {
    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Dashboard</h1>
                    <p className="text-[var(--color-text-secondary)] mt-1">Your markets, bets, and winnings at a glance.</p>
                </div>
            </div>
            <UserDashboard />
        </div>
    );
}
