import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAnalytics } from '../../hooks/useAnalytics';
import { OverviewAnalytics } from './OverviewAnalytics';
import { MarketsAnalytics } from './MarketsAnalytics';
import { TrendsAnalytics } from './TrendsAnalytics';
import { WalletsAnalytics } from './WalletsAnalytics';
import { OraclesAnalytics } from './OraclesAnalytics';
import { CoinsAnalytics } from './CoinsAnalytics';

type Tab = 'overview' | 'markets' | 'trends' | 'wallets' | 'oracles' | 'coins';

const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'markets', label: 'Markets' },
    { key: 'trends', label: 'Trends' },
    { key: 'oracles', label: 'Oracles' },
    { key: 'coins', label: 'Coins' },
    { key: 'wallets', label: 'Wallets' },
];

export function AnalyticsPage(): React.JSX.Element {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as Tab) || 'overview';
    const { data, loading, error, refresh } = useAnalytics();
    const [search, setSearch] = useState('');
    const [blockRange, setBlockRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
    const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const setTab = (tab: Tab) => {
        setSearchParams({ tab });
    };

    const hasFilters = blockRange.from || blockRange.to || search || dateRange.from || dateRange.to;

    const clearFilters = () => {
        setSearch('');
        setBlockRange({ from: '', to: '' });
        setDateRange({ from: '', to: '' });
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-[#e4e4ec]">Analytics</h1>
                    <p className="text-[#8888a0] mt-1">On-chain prediction market insights</p>
                </div>
                <button
                    onClick={() => void refresh(true)}
                    disabled={loading}
                    className="bg-[#1a1a2a] border border-[#2a2a3a] hover:border-[#f7931a] text-[#e4e4ec] px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                    {loading ? 'Loading...' : 'Refresh'}
                </button>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 bg-[#111118] border border-[#2a2a3a] rounded-xl p-1 mb-6 overflow-x-auto">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setTab(tab.key)}
                        className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                            activeTab === tab.key
                                ? 'bg-[#f7931a] text-black'
                                : 'text-[#8888a0] hover:text-[#e4e4ec] hover:bg-[#1a1a24]'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search markets, wallets, oracles..."
                    className="flex-1 min-w-[200px] bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-2.5 text-sm text-[#e4e4ec] placeholder-[#555] focus:border-[#f7931a] focus:outline-none transition-colors"
                />
                <div className="flex items-center gap-2">
                    <span className="text-xs text-[#555]">Block</span>
                    <input
                        type="number"
                        value={blockRange.from}
                        onChange={(e) => setBlockRange((prev) => ({ ...prev, from: e.target.value }))}
                        placeholder="From"
                        className="w-24 bg-[#111118] border border-[#2a2a3a] rounded-lg px-3 py-2.5 text-sm text-[#e4e4ec] placeholder-[#555] focus:border-[#f7931a] focus:outline-none transition-colors"
                    />
                    <span className="text-[#555]">-</span>
                    <input
                        type="number"
                        value={blockRange.to}
                        onChange={(e) => setBlockRange((prev) => ({ ...prev, to: e.target.value }))}
                        placeholder="To"
                        className="w-24 bg-[#111118] border border-[#2a2a3a] rounded-lg px-3 py-2.5 text-sm text-[#e4e4ec] placeholder-[#555] focus:border-[#f7931a] focus:outline-none transition-colors"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-[#555]">Date</span>
                    <input
                        type="date"
                        value={dateRange.from}
                        onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
                        className="bg-[#111118] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#e4e4ec] focus:border-[#f7931a] focus:outline-none transition-colors [color-scheme:dark]"
                    />
                    <span className="text-[#555]">-</span>
                    <input
                        type="date"
                        value={dateRange.to}
                        onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
                        className="bg-[#111118] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#e4e4ec] focus:border-[#f7931a] focus:outline-none transition-colors [color-scheme:dark]"
                    />
                </div>
                {hasFilters && (
                    <button
                        onClick={clearFilters}
                        className="text-xs text-[#8888a0] hover:text-[#f7931a] transition-colors cursor-pointer px-2"
                    >
                        Clear
                    </button>
                )}
            </div>

            {error && (
                <div className="text-red-400 text-sm bg-red-400/10 px-4 py-3 rounded-lg mb-6">
                    {error}
                </div>
            )}

            {loading && !data && (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-pulse text-[#f7931a] text-lg">Loading analytics...</div>
                </div>
            )}

            {data && activeTab === 'overview' && (
                <OverviewAnalytics data={data} search={search} blockRange={blockRange} dateRange={dateRange} />
            )}
            {data && activeTab === 'markets' && (
                <MarketsAnalytics data={data} search={search} blockRange={blockRange} dateRange={dateRange} />
            )}
            {data && activeTab === 'trends' && (
                <TrendsAnalytics data={data} search={search} blockRange={blockRange} dateRange={dateRange} />
            )}
            {data && activeTab === 'oracles' && (
                <OraclesAnalytics data={data} search={search} />
            )}
            {data && activeTab === 'coins' && (
                <CoinsAnalytics data={data} search={search} blockRange={blockRange} dateRange={dateRange} />
            )}
            {data && activeTab === 'wallets' && (
                <WalletsAnalytics data={data} search={search} />
            )}

            {!loading && !data && !error && (
                <div className="text-center py-20">
                    <p className="text-[#8888a0]">No data available yet</p>
                    <p className="text-[#555] text-sm mt-1">Markets will appear here once created on-chain</p>
                </div>
            )}
        </div>
    );
}
