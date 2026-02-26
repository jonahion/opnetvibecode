import { useEffect, useState, useCallback, useMemo } from 'react';
import { usePredictionMarket } from '../../hooks/usePredictionMarket';
import { MarketCard } from './MarketCard';
import { MarketData } from '../../types';

const PAGE_SIZE = 10;

export function MarketList(): React.JSX.Element {
    const { fetchMarketCount, fetchMarket } = usePredictionMarket();
    const [markets, setMarkets] = useState<MarketData[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const loadMarkets = useCallback(async (): Promise<void> => {
        setLoading(true);
        try {
            const count = await fetchMarketCount();
            const fetched: MarketData[] = [];

            const MAX_DISPLAY = 100;
            const start = count > BigInt(MAX_DISPLAY) ? count - BigInt(MAX_DISPLAY) + 1n : 1n;

            for (let i = count; i >= start; i--) {
                try {
                    const market = await fetchMarket(i);
                    fetched.push(market);
                } catch {
                    // skip individual market errors
                }
            }

            setMarkets(fetched);
        } catch {
            // contract not deployed yet — show empty state
        } finally {
            setLoading(false);
        }
    }, [fetchMarketCount, fetchMarket]);

    useEffect(() => {
        void loadMarkets();
    }, [loadMarkets]);

    const filtered = useMemo(() => {
        if (!search) return markets;
        const q = search.toLowerCase();
        return markets.filter(
            (m) =>
                m.question.toLowerCase().includes(q) ||
                `#${m.id}`.includes(q) ||
                m.creator.toLowerCase().includes(q) ||
                m.oracle.toLowerCase().includes(q),
        );
    }, [markets, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // Reset page when search changes
    useEffect(() => {
        setPage(1);
    }, [search]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-pulse text-[#f7931a] text-lg">Loading markets...</div>
            </div>
        );
    }

    if (markets.length === 0) {
        return (
            <div className="text-center py-20">
                <p className="text-3xl mb-3">&#x1f52e;</p>
                <p className="text-[#8888a0] text-lg">No markets yet</p>
                <p className="text-[#555] text-sm mt-1">Be the first to create a prediction market!</p>
                <p className="text-[#555] text-xs mt-4">
                    Recently created a market? It may take ~10 min for the next block to confirm it.
                </p>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-4 text-xs text-[#555] bg-[#1a1a2a] border border-[#2a2a3a] rounded-lg px-4 py-2">
                OPNet blocks are mined every ~10 minutes. New markets and bets appear after block confirmation.
            </div>

            {/* Search */}
            <div className="mb-6">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search markets by title, ID, creator..."
                    className="w-full bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-2.5 text-sm text-[#e4e4ec] placeholder-[#555] focus:border-[#f7931a] focus:outline-none transition-colors"
                />
            </div>

            {/* Results count */}
            {search && (
                <p className="text-xs text-[#555] mb-4">
                    {filtered.length} market{filtered.length !== 1 ? 's' : ''} found
                    {filtered.length === 0 && (
                        <button
                            onClick={() => setSearch('')}
                            className="ml-2 text-[#f7931a] hover:underline cursor-pointer"
                        >
                            Clear search
                        </button>
                    )}
                </p>
            )}

            {/* Market grid */}
            <div className="grid gap-4 md:grid-cols-2">
                {paged.map((market) => (
                    <MarketCard key={market.id.toString()} market={market} />
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 rounded-lg text-sm bg-[#1a1a2a] border border-[#2a2a3a] text-[#e4e4ec] disabled:opacity-30 hover:border-[#f7931a] transition-colors cursor-pointer disabled:cursor-default"
                    >
                        Prev
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                                p === page
                                    ? 'bg-[#f7931a] text-black'
                                    : 'bg-[#1a1a2a] border border-[#2a2a3a] text-[#8888a0] hover:text-[#e4e4ec]'
                            }`}
                        >
                            {p}
                        </button>
                    ))}
                    <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1.5 rounded-lg text-sm bg-[#1a1a2a] border border-[#2a2a3a] text-[#e4e4ec] disabled:opacity-30 hover:border-[#f7931a] transition-colors cursor-pointer disabled:cursor-default"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
