import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAnalytics } from '../../hooks/useAnalytics';
import { MarketsAnalytics } from './MarketsAnalytics';
import { TrendsAnalytics } from './TrendsAnalytics';
import { WalletsAnalytics } from './WalletsAnalytics';

type Tab = 'markets' | 'trends' | 'wallets';

const TABS: { key: Tab; label: string }[] = [
    { key: 'markets', label: 'Markets' },
    { key: 'trends', label: 'Trends' },
    { key: 'wallets', label: 'Wallets' },
];

export function AnalyticsPage(): React.JSX.Element {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as Tab) || 'markets';
    const { data, loading, error, refresh } = useAnalytics();
    const [search, setSearch] = useState('');
    const [blockRange, setBlockRange] = useState<{ from: string; to: string }>({ from: '', to: '' });

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const setTab = (tab: Tab) => {
        setSearchParams({ tab });
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-[#e4e4ec]">Analytics</h1>
                    <p className="text-[#8888a0] mt-1">On-chain prediction market insights</p>
                </div>
                <button
                    onClick={() => void refresh()}
                    disabled={loading}
                    className="bg-[#1a1a2a] border border-[#2a2a3a] hover:border-[#f7931a] text-[#e4e4ec] px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                    {loading ? 'Loading...' : 'Refresh'}
                </button>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 bg-[#111118] border border-[#2a2a3a] rounded-xl p-1 mb-6">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setTab(tab.key)}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
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
                    placeholder="Search markets, wallets..."
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
                    {(blockRange.from || blockRange.to || search) && (
                        <button
                            onClick={() => { setSearch(''); setBlockRange({ from: '', to: '' }); }}
                            className="text-xs text-[#8888a0] hover:text-[#f7931a] transition-colors cursor-pointer"
                        >
                            Clear
                        </button>
                    )}
                </div>
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

            {data && activeTab === 'markets' && (
                <MarketsAnalytics data={data} search={search} blockRange={blockRange} />
            )}
            {data && activeTab === 'trends' && (
                <TrendsAnalytics data={data} search={search} blockRange={blockRange} />
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
