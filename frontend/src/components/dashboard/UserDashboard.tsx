import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { usePredictionMarket } from '../../hooks/usePredictionMarket';
import { Card } from '../common/Card';
import { MarketData, MarketStatus, MarketOutcome, UserPosition } from '../../types';

interface MarketWithPosition {
    market: MarketData;
    position: UserPosition;
}

function formatSats(sats: bigint): string {
    const btc = Number(sats) / 100_000_000;
    if (btc >= 0.001) return `${btc.toFixed(4)} BTC`;
    return `${Number(sats).toLocaleString()} sats`;
}

function normalize(v: unknown): string {
    if (!v) return '';
    if (v instanceof Uint8Array) {
        return Array.from(v).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    return String(v).toLowerCase().replace(/^0x/, '');
}

type DashTab = 'bets' | 'created' | 'oracle' | 'claims';

export function UserDashboard(): React.JSX.Element {
    const { address } = useWalletConnect();
    const { fetchMarketCount, fetchMarket, fetchUserPosition, fetchCurrentBlock } = usePredictionMarket();
    const navigate = useNavigate();

    const [markets, setMarkets] = useState<MarketData[]>([]);
    const [positions, setPositions] = useState<Map<string, UserPosition>>(new Map());
    const [currentBlock, setCurrentBlock] = useState<bigint | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<DashTab>('bets');

    const walletHex = useMemo(() => normalize(address).replace(/^0+/, ''), [address]);

    const load = useCallback(async () => {
        if (!address) { setLoading(false); return; }
        setLoading(true);
        try {
            const [count, block] = await Promise.all([fetchMarketCount(), fetchCurrentBlock()]);
            setCurrentBlock(block);

            const allMarkets: MarketData[] = [];
            const posMap = new Map<string, UserPosition>();

            for (let i = 1n; i <= count; i++) {
                try {
                    const m = await fetchMarket(i);
                    allMarkets.push(m);
                    try {
                        const pos = await fetchUserPosition(i);
                        if (pos.yesBet > 0n || pos.noBet > 0n) {
                            posMap.set(m.id.toString(), pos);
                        }
                    } catch {
                        // no position
                    }
                } catch {
                    // skip
                }
            }

            setMarkets(allMarkets);
            setPositions(posMap);
        } catch {
            // empty state
        } finally {
            setLoading(false);
        }
    }, [address, fetchMarketCount, fetchMarket, fetchUserPosition, fetchCurrentBlock]);

    useEffect(() => { void load(); }, [load]);

    // Markets where user has a bet
    const myBets = useMemo((): MarketWithPosition[] => {
        const result: MarketWithPosition[] = [];
        for (const m of markets) {
            const pos = positions.get(m.id.toString());
            if (pos) result.push({ market: m, position: pos });
        }
        return result;
    }, [markets, positions]);

    // Markets created by this wallet
    const myCreated = useMemo(() => {
        if (!walletHex) return [];
        return markets.filter((m) => {
            const creatorHex = m.creator.toLowerCase().replace(/^0x/, '').replace(/^0+/, '');
            return creatorHex === walletHex;
        });
    }, [markets, walletHex]);

    // Markets where user is oracle
    const myOracle = useMemo(() => {
        if (!walletHex) return [];
        return markets.filter((m) => {
            const oracleHex = m.oracle.toLowerCase().replace(/^0x/, '').replace(/^0+/, '');
            return oracleHex === walletHex;
        });
    }, [markets, walletHex]);

    // Pending claims: resolved markets where user has a winning position and hasn't claimed
    const pendingClaims = useMemo((): MarketWithPosition[] => {
        return myBets.filter(({ market, position }) => {
            if (market.status !== MarketStatus.RESOLVED) return false;
            if (position.claimed) return false;
            if (market.outcome === MarketOutcome.YES && position.yesBet > 0n) return true;
            if (market.outcome === MarketOutcome.NO && position.noBet > 0n) return true;
            return false;
        });
    }, [myBets]);

    // Already claimed rewards
    const claimedRewards = useMemo((): MarketWithPosition[] => {
        return myBets.filter(({ market, position }) => {
            if (market.status !== MarketStatus.RESOLVED) return false;
            if (!position.claimed) return false;
            if (market.outcome === MarketOutcome.YES && position.yesBet > 0n) return true;
            if (market.outcome === MarketOutcome.NO && position.noBet > 0n) return true;
            return false;
        });
    }, [myBets]);

    const totalClaims = pendingClaims.length + claimedRewards.length;

    // Pending resolution: oracle markets past deadline but not resolved
    const pendingResolution = useMemo(() => {
        if (!currentBlock) return [];
        return myOracle.filter((m) => m.status === MarketStatus.OPEN && currentBlock >= m.endBlock);
    }, [myOracle, currentBlock]);

    if (!address) {
        return (
            <div className="text-center py-20">
                <p className="text-3xl mb-3">&#x1f4ca;</p>
                <p className="text-[var(--color-text-secondary)] text-lg">Connect your wallet to see your dashboard</p>
                <p className="text-[var(--color-text-muted)] text-sm mt-1">Your markets, bets, and claimable winnings will appear here.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-pulse text-[var(--color-btc-orange)] text-lg">Loading dashboard...</div>
            </div>
        );
    }

    const tabs: { key: DashTab; label: string; count: number }[] = [
        { key: 'created', label: 'Markets', count: myCreated.length },
        { key: 'bets', label: 'My Bets', count: myBets.length },
        { key: 'oracle', label: 'Oracle', count: myOracle.length },
        { key: 'claims', label: 'Claims', count: totalClaims },
    ];

    return (
        <div>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <Card>
                    <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">My Markets</p>
                    <p className="text-2xl font-bold text-green-400">{myCreated.length}</p>
                </Card>
                <Card>
                    <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">My Bets</p>
                    <p className="text-2xl font-bold text-[var(--color-btc-orange)]">{myBets.length}</p>
                </Card>
                <Card>
                    <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Oracle Duties</p>
                    <p className="text-2xl font-bold text-purple-400">{myOracle.length}</p>
                    {pendingResolution.length > 0 && (
                        <p className="text-xs text-yellow-400 mt-1">{pendingResolution.length} awaiting resolution</p>
                    )}
                </Card>
                <Card>
                    <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Claims</p>
                    <p className="text-2xl font-bold text-[var(--color-btc-orange)]">{totalClaims}</p>
                    {pendingClaims.length > 0 && (
                        <p className="text-xs text-yellow-400 mt-1">{pendingClaims.length} pending</p>
                    )}
                </Card>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-xl p-1 mb-6">
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2 ${
                            tab === t.key
                                ? 'bg-[var(--color-btc-orange)] text-black'
                                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                        }`}
                    >
                        {t.label}
                        {t.count > 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                tab === t.key ? 'bg-black/20' : 'bg-[var(--color-border)]'
                            }`}>
                                {t.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {tab === 'bets' && (
                <div>
                    {myBets.length === 0 ? (
                        <div className="text-center py-12 text-[var(--color-text-secondary)]">
                            You haven&apos;t placed any bets yet.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {myBets.map(({ market, position }) => (
                                <Card
                                    key={market.id.toString()}
                                    hoverable
                                    onClick={() => navigate(`/market/${market.id}`)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0 mr-4">
                                            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{market.question}</p>
                                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Market #{market.id.toString()}</p>
                                        </div>
                                        <div className="flex items-center gap-4 shrink-0">
                                            {position.yesBet > 0n && (
                                                <span className="text-sm text-green-400 font-medium">YES {formatSats(position.yesBet)}</span>
                                            )}
                                            {position.noBet > 0n && (
                                                <span className="text-sm text-red-400 font-medium">NO {formatSats(position.noBet)}</span>
                                            )}
                                            <StatusBadge market={market} currentBlock={currentBlock} />
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {tab === 'created' && (
                <div>
                    {myCreated.length === 0 ? (
                        <div className="text-center py-12 text-[var(--color-text-secondary)]">
                            You haven&apos;t created any markets yet.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {myCreated.map((market) => (
                                <Card
                                    key={market.id.toString()}
                                    hoverable
                                    onClick={() => navigate(`/market/${market.id}`)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0 mr-4">
                                            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{market.question}</p>
                                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Market #{market.id.toString()}</p>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="text-sm text-[var(--color-text-secondary)]">Pool: {formatSats(market.yesPool + market.noPool)}</span>
                                            <StatusBadge market={market} currentBlock={currentBlock} />
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {tab === 'oracle' && (
                <div>
                    {myOracle.length === 0 ? (
                        <div className="text-center py-12 text-[var(--color-text-secondary)]">
                            You are not an oracle for any markets.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {myOracle.map((market) => {
                                const needsResolution = market.status === MarketStatus.OPEN && currentBlock !== null && currentBlock >= market.endBlock;
                                return (
                                    <Card
                                        key={market.id.toString()}
                                        hoverable
                                        onClick={() => navigate(`/market/${market.id}`)}
                                        className={needsResolution ? 'border-yellow-500/50' : ''}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0 mr-4">
                                                <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{market.question}</p>
                                                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Market #{market.id.toString()}</p>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                {needsResolution && (
                                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full text-yellow-400 bg-yellow-400/10">
                                                        NEEDS RESOLUTION
                                                    </span>
                                                )}
                                                <StatusBadge market={market} currentBlock={currentBlock} />
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {tab === 'claims' && (
                <div>
                    {totalClaims === 0 ? (
                        <div className="text-center py-12 text-[var(--color-text-secondary)]">
                            No claims yet. Win a resolved market to see claims here.
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Pending Claims */}
                            <div>
                                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                                    Pending Claims
                                    {pendingClaims.length > 0 && (
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-yellow-400 bg-yellow-400/10">
                                            {pendingClaims.length}
                                        </span>
                                    )}
                                </h3>
                                {pendingClaims.length === 0 ? (
                                    <p className="text-sm text-[var(--color-text-muted)] py-4">No pending claims.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {pendingClaims.map(({ market, position }) => (
                                            <Card
                                                key={market.id.toString()}
                                                hoverable
                                                onClick={() => navigate(`/market/${market.id}`)}
                                                className="border-[var(--color-btc-orange)]/50"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1 min-w-0 mr-4">
                                                        <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{market.question}</p>
                                                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Market #{market.id.toString()}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <span className="text-sm font-medium text-[var(--color-btc-orange)]">
                                                            Won with {market.outcome === MarketOutcome.YES ? 'YES' : 'NO'}
                                                        </span>
                                                        <span className="text-sm text-[var(--color-text-secondary)]">
                                                            Bet: {formatSats(market.outcome === MarketOutcome.YES ? position.yesBet : position.noBet)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Claimed Rewards */}
                            <div>
                                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                                    Claimed Rewards
                                    {claimedRewards.length > 0 && (
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-green-400 bg-green-400/10">
                                            {claimedRewards.length}
                                        </span>
                                    )}
                                </h3>
                                {claimedRewards.length === 0 ? (
                                    <p className="text-sm text-[var(--color-text-muted)] py-4">No claimed rewards yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {claimedRewards.map(({ market, position }) => (
                                            <Card
                                                key={market.id.toString()}
                                                hoverable
                                                onClick={() => navigate(`/market/${market.id}`)}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1 min-w-0 mr-4">
                                                        <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{market.question}</p>
                                                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Market #{market.id.toString()}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-green-400 bg-green-400/10">
                                                            CLAIMED
                                                        </span>
                                                        <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                                                            {market.outcome === MarketOutcome.YES ? 'YES' : 'NO'}
                                                        </span>
                                                        <span className="text-sm text-[var(--color-text-muted)]">
                                                            Bet: {formatSats(market.outcome === MarketOutcome.YES ? position.yesBet : position.noBet)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function StatusBadge({ market, currentBlock }: { market: MarketData; currentBlock: bigint | null }): React.JSX.Element {
    if (market.status === MarketStatus.RESOLVED) {
        return (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-[var(--color-text-secondary)] bg-[var(--color-text-secondary)]/10">
                {market.outcome === MarketOutcome.YES ? 'YES' : 'NO'}
            </span>
        );
    }
    if (currentBlock !== null && currentBlock >= market.endBlock) {
        return (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-yellow-400 bg-yellow-400/10">
                AWAITING
            </span>
        );
    }
    return (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-green-400 bg-green-400/10">
            LIVE
        </span>
    );
}
