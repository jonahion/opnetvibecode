import { useEffect, useState, useCallback, useMemo } from 'react';
import { usePredictionMarket } from '../../hooks/usePredictionMarket';
import type { PendingTx } from '../../hooks/usePredictionMarket';
import { MarketCard } from './MarketCard';
import { MarketData, MarketStatus, MarketCategory } from '../../types';
import { Card } from '../common/Card';
import { getMarketMetadata } from '../../utils/marketQuestions';

const PAGE_SIZE = 10;

type TabKey = 'live' | 'awaiting' | 'pending' | 'resolved';

function truncateId(id: string): string {
    if (id.length <= 16) return id;
    return `${id.slice(0, 8)}...${id.slice(-8)}`;
}

function timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
}

function PendingTxCard({ tx }: { tx: PendingTx }): React.JSX.Element {
    return (
        <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-[var(--color-btc-orange)]/5 animate-pulse pointer-events-none" />
            <div className="relative">
                <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] leading-snug flex-1 mr-3">
                        {tx.question || 'New Market'}
                    </h3>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0 text-[var(--color-btc-orange)] bg-[var(--color-btc-orange)]/10 animate-pulse">
                        PENDING
                    </span>
                </div>

                <div className="space-y-1.5 text-sm text-[var(--color-text-muted)]">
                    <div className="flex items-center justify-between">
                        <span>TxID</span>
                        <span className="font-mono text-[var(--color-text-secondary)]">{truncateId(tx.txId)}</span>
                    </div>
                    {tx.from && (
                        <div className="flex items-center justify-between">
                            <span>From</span>
                            <span className="font-mono text-[var(--color-text-secondary)]">{truncateId(tx.from)}</span>
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <span>Seen</span>
                        <span className="text-[var(--color-text-secondary)]">{timeAgo(tx.firstSeen)}</span>
                    </div>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-3">
                    Waiting for next block confirmation (~10 min)
                </p>
            </div>
        </Card>
    );
}

export function MarketList(): React.JSX.Element {
    const { fetchMarketCount, fetchMarket, fetchCurrentBlock, fetchPendingTxs } = usePredictionMarket();
    const [markets, setMarkets] = useState<MarketData[]>([]);
    const [pendingTxs, setPendingTxs] = useState<PendingTx[]>([]);
    const [currentBlock, setCurrentBlock] = useState<bigint | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [tab, setTab] = useState<TabKey>('live');

    const loadMarkets = useCallback(async (): Promise<void> => {
        setLoading(true);
        try {
            const [count, block, pending] = await Promise.all([
                fetchMarketCount(),
                fetchCurrentBlock(),
                fetchPendingTxs(),
            ]);
            setCurrentBlock(block);
            setPendingTxs(pending);
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
    }, [fetchMarketCount, fetchMarket, fetchCurrentBlock, fetchPendingTxs]);

    useEffect(() => {
        void loadMarkets();
    }, [loadMarkets]);

    // Split confirmed markets into live, awaiting resolution, and resolved
    const { liveMarkets, awaitingMarkets, resolvedMarkets } = useMemo(() => {
        const live: MarketData[] = [];
        const awaiting: MarketData[] = [];
        const resolved: MarketData[] = [];

        for (const m of markets) {
            if (m.status === MarketStatus.RESOLVED) {
                resolved.push(m);
            } else if (currentBlock !== null && currentBlock >= m.endBlock) {
                awaiting.push(m);
            } else {
                live.push(m);
            }
        }
        return { liveMarkets: live, awaitingMarkets: awaiting, resolvedMarkets: resolved };
    }, [markets, currentBlock]);

    // Filter pending txs to only show new markets (not bets, resolves, claims)
    const pendingMarketTxs = useMemo(() =>
        pendingTxs.filter((tx) => tx.txType === 'createMarket' || tx.txType === 'unknown'),
    [pendingTxs]);

    const activeList = tab === 'live' ? liveMarkets : tab === 'awaiting' ? awaitingMarkets : tab === 'resolved' ? resolvedMarkets : [];

    const filtered = useMemo(() => {
        if (!search) return activeList;
        const q = search.toLowerCase();
        return activeList.filter(
            (m) =>
                m.question.toLowerCase().includes(q) ||
                `#${m.id}`.includes(q) ||
                m.creator.toLowerCase().includes(q) ||
                m.oracle.toLowerCase().includes(q),
        );
    }, [activeList, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // Group paged markets by category
    const grouped = useMemo(() => {
        const groups: { category: MarketCategory | 'other'; label: string; markets: MarketData[] }[] = [];
        const buckets = new Map<string, MarketData[]>();
        for (const m of paged) {
            const meta = getMarketMetadata(m.id);
            const cat = meta?.category ?? 'other';
            if (!buckets.has(cat)) buckets.set(cat, []);
            buckets.get(cat)!.push(m);
        }
        const categoryLabels: Record<string, string> = { price: 'Price Predictions', event: 'Event Predictions', other: 'Other' };
        const order: string[] = ['price', 'event', 'other'];
        for (const key of order) {
            const list = buckets.get(key);
            if (list && list.length > 0) {
                groups.push({ category: key as MarketCategory | 'other', label: categoryLabels[key], markets: list });
            }
        }
        return groups;
    }, [paged]);

    // Reset page when search or tab changes
    useEffect(() => {
        setPage(1);
    }, [search, tab]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-pulse text-[var(--color-btc-orange)] text-lg">Loading markets...</div>
            </div>
        );
    }

    if (markets.length === 0 && pendingMarketTxs.length === 0) {
        return (
            <div className="text-center py-20">
                <p className="text-3xl mb-3">&#x1f52e;</p>
                <p className="text-[var(--color-text-secondary)] text-lg">No markets yet</p>
                <p className="text-[var(--color-text-muted)] text-sm mt-1">Be the first to create a prediction market!</p>
                <p className="text-[var(--color-text-muted)] text-xs mt-4">
                    Recently created a market? It may take ~10 min for the next block to confirm it.
                </p>
            </div>
        );
    }

    const tabs: { key: TabKey; label: string; count: number }[] = [
        { key: 'live', label: 'Live', count: liveMarkets.length },
        { key: 'pending', label: 'Pending', count: pendingMarketTxs.length },
        { key: 'awaiting', label: 'Awaiting Resolution', count: awaitingMarkets.length },
        { key: 'resolved', label: 'Resolved', count: resolvedMarkets.length },
    ];

    return (
        <div>
            <div className="mb-4 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-4 py-2">
                OPNet blocks are mined every ~10 minutes. New markets and bets appear after block confirmation.
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-xl p-1 mb-6">
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2 ${
                            tab === t.key
                                ? t.key === 'pending'
                                    ? 'bg-[var(--color-btc-orange)] text-black'
                                    : t.key === 'awaiting'
                                        ? 'bg-yellow-500/20 text-yellow-400'
                                        : t.key === 'resolved'
                                            ? 'bg-[var(--color-text-secondary)]/20 text-[var(--color-text-primary)]'
                                            : 'bg-green-500/20 text-green-400'
                                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                        }`}
                    >
                        {t.label}
                        {t.count > 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                tab === t.key
                                    ? t.key === 'pending' ? 'bg-black/20' : 'bg-white/10'
                                    : 'bg-[var(--color-border)]'
                            }`}>
                                {t.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Search (not for pending tab) */}
            {tab !== 'pending' && (
                <div className="mb-6">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search markets by title, ID, creator..."
                        className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-btc-orange)] focus:outline-none transition-colors"
                    />
                </div>
            )}

            {/* Results count */}
            {search && tab !== 'pending' && (
                <p className="text-xs text-[var(--color-text-muted)] mb-4">
                    {filtered.length} market{filtered.length !== 1 ? 's' : ''} found
                    {filtered.length === 0 && (
                        <button
                            onClick={() => setSearch('')}
                            className="ml-2 text-[var(--color-btc-orange)] hover:underline cursor-pointer"
                        >
                            Clear search
                        </button>
                    )}
                </p>
            )}

            {/* Pending tab content */}
            {tab === 'pending' && (
                <>
                    {pendingMarketTxs.length > 0 && (
                        <div className="mb-4 text-xs text-[var(--color-btc-orange)] bg-[var(--color-btc-orange)]/10 border border-[var(--color-btc-orange)]/20 rounded-lg px-4 py-2.5">
                            These transactions have been broadcast but not yet confirmed in a block. They will appear as live markets after the next block is mined (~10 min).
                        </div>
                    )}
                    {pendingMarketTxs.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-[var(--color-text-secondary)]">
                                No pending markets in the mempool.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {pendingMarketTxs.map((tx) => (
                                <PendingTxCard key={tx.txId} tx={tx} />
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Live / Awaiting / Resolved tab content */}
            {tab !== 'pending' && (
                <>
                    {/* Empty state per tab */}
                    {filtered.length === 0 && !search && (
                        <div className="text-center py-12">
                            <p className="text-[var(--color-text-secondary)]">
                                {tab === 'live' && 'No live markets right now.'}
                                {tab === 'awaiting' && 'No markets awaiting resolution.'}
                                {tab === 'resolved' && 'No resolved markets yet.'}
                            </p>
                        </div>
                    )}

                    {/* Market grid grouped by category */}
                    {grouped.map((group) => (
                        <div key={group.category} className="mb-6 last:mb-0">
                            {grouped.length > 1 && (
                                <div className="flex items-center gap-2 mb-3">
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                        group.category === 'price'
                                            ? 'text-[var(--color-btc-orange)] bg-[var(--color-btc-orange)]/10'
                                            : group.category === 'event'
                                                ? 'text-purple-400 bg-purple-400/10'
                                                : 'text-[var(--color-text-secondary)] bg-[var(--color-text-secondary)]/10'
                                    }`}>
                                        {group.label}
                                    </span>
                                    <span className="text-xs text-[var(--color-text-muted)]">
                                        {group.markets.length}
                                    </span>
                                </div>
                            )}
                            <div className="grid gap-4 md:grid-cols-2">
                                {group.markets.map((market) => (
                                    <MarketCard
                                        key={market.id.toString()}
                                        market={market}
                                        isAwaitingResolution={tab === 'awaiting'}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-8">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-bg-card-hover)] border border-[var(--color-border)] text-[var(--color-text-primary)] disabled:opacity-30 hover:border-[var(--color-btc-orange)] transition-colors cursor-pointer disabled:cursor-default"
                            >
                                Prev
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                                        p === page
                                            ? 'bg-[var(--color-btc-orange)] text-black'
                                            : 'bg-[var(--color-bg-card-hover)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                    }`}
                                >
                                    {p}
                                </button>
                            ))}
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-bg-card-hover)] border border-[var(--color-border)] text-[var(--color-text-primary)] disabled:opacity-30 hover:border-[var(--color-btc-orange)] transition-colors cursor-pointer disabled:cursor-default"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
