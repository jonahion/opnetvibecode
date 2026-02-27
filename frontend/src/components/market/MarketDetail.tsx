import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { usePredictionMarket } from '../../hooks/usePredictionMarket';
import type { PendingTx } from '../../hooks/usePredictionMarket';
import { MarketData, MarketStatus, MarketOutcome, UserPosition } from '../../types';

function formatSats(sats: bigint): string {
    const btc = Number(sats) / 100_000_000;
    if (btc >= 0.001) return `${btc.toFixed(4)} BTC`;
    return `${sats.toLocaleString()} sats`;
}

function truncateId(id: string): string {
    if (id.length <= 16) return id;
    return `${id.slice(0, 8)}...${id.slice(-8)}`;
}

function pendingLabel(tx: PendingTx): string {
    switch (tx.txType) {
        case 'placeBet': return `Bet ${tx.betOutcome === 1 ? 'YES' : tx.betOutcome === 2 ? 'NO' : ''} — ${tx.betAmount !== undefined ? formatSats(tx.betAmount) : ''}`;
        case 'resolveMarket': return 'Market resolution';
        case 'claimWinnings': return 'Claim winnings';
        case 'createMarket': return tx.question ?? 'New market';
        default: return 'Transaction';
    }
}

function timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
}

export function MarketDetail(): React.JSX.Element {
    const { id } = useParams<{ id: string }>();
    const { address } = useWalletConnect();
    const {
        fetchMarket,
        fetchUserPosition,
        fetchCurrentBlock,
        fetchCallerAddress,
        fetchPendingTxs,
        placeBet,
        resolveMarket,
        claimWinnings,
        loading,
        error,
    } = usePredictionMarket();

    const [market, setMarket] = useState<MarketData | null>(null);
    const [position, setPosition] = useState<UserPosition | null>(null);
    const [currentBlock, setCurrentBlock] = useState<bigint | null>(null);
    const [callerAddress, setCallerAddress] = useState<string | null>(null);
    const [loadingData, setLoadingData] = useState(true);
    const [pendingTxs, setPendingTxs] = useState<PendingTx[]>([]);
    const [betAmount, setBetAmount] = useState('10000');
    const [errorSource, setErrorSource] = useState<'bet' | 'resolve' | 'claim' | null>(null);
    const [betSuccess, setBetSuccess] = useState(false);

    const marketId = BigInt(id ?? '0');

    const loadData = useCallback(async (): Promise<void> => {
        setLoadingData(true);
        try {
            const [m, block, pending] = await Promise.all([
                fetchMarket(marketId),
                fetchCurrentBlock(),
                fetchPendingTxs(),
            ]);
            setMarket(m);
            setCurrentBlock(block);
            setPendingTxs(pending.filter((tx) => tx.marketId !== undefined && tx.marketId === marketId));
            if (address) {
                const [p, caller] = await Promise.all([
                    fetchUserPosition(marketId),
                    fetchCallerAddress(),
                ]);
                setPosition(p);
                setCallerAddress(caller);
            }
        } catch {
            // error handled by hook
        } finally {
            setLoadingData(false);
        }
    }, [marketId, address, fetchMarket, fetchUserPosition, fetchCurrentBlock, fetchCallerAddress, fetchPendingTxs]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const handleBet = async (outcome: MarketOutcome): Promise<void> => {
        setErrorSource('bet');
        setBetSuccess(false);
        try {
            const amount = BigInt(betAmount);
            await placeBet(marketId, outcome, amount);
            setErrorSource(null);
            setBetSuccess(true);
            await loadData();
        } catch {
            // error is set by the hook
        }
    };

    const handleResolve = async (outcome: MarketOutcome): Promise<void> => {
        setErrorSource('resolve');
        try {
            await resolveMarket(marketId, outcome);
            setErrorSource(null);
            await loadData();
        } catch {
            // error is set by the hook
        }
    };

    const handleClaim = async (): Promise<void> => {
        setErrorSource('claim');
        try {
            await claimWinnings(marketId);
            setErrorSource(null);
            await loadData();
        } catch {
            // error is set by the hook
        }
    };

    if (loadingData) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-pulse text-[var(--color-btc-orange)] text-lg">Loading market...</div>
            </div>
        );
    }

    if (!market) {
        return (
            <Card className="max-w-2xl mx-auto text-center">
                <p className="text-[var(--color-text-secondary)]">Market not found</p>
            </Card>
        );
    }

    const totalPool = market.yesPool + market.noPool;
    const yesPercent = totalPool > 0n
        ? Number((market.yesPool * 10000n) / totalPool) / 100
        : 50;
    const noPercent = totalPool > 0n ? 100 - yesPercent : 50;
    const isOpen = market.status === MarketStatus.OPEN;
    const isResolved = market.status === MarketStatus.RESOLVED;
    // Convert wallet address (Uint8Array with custom toString, or string) to lowercase hex
    const normalize = (v: unknown): string => {
        if (!v) return '';
        if (v instanceof Uint8Array) {
            return Array.from(v).map((b) => b.toString(16).padStart(2, '0')).join('');
        }
        return String(v).toLowerCase().replace(/^0x/, '');
    };
    const oracleHex = normalize(market.oracle).replace(/^0+/, '');
    const callerHex = normalize(callerAddress).replace(/^0+/, '');
    const walletHex = normalize(address).replace(/^0+/, '');
    const isOracle = (callerHex !== '' && oracleHex === callerHex) || (walletHex !== '' && oracleHex === walletHex);
    const deadlineReached = currentBlock !== null && currentBlock >= market.endBlock;

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <Card>
                <div className="flex items-start justify-between mb-6">
                    <h1 className="text-2xl font-bold text-[var(--color-text-primary)] leading-snug flex-1">
                        {market.question}
                    </h1>
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full shrink-0 ml-4 ${
                        isOpen ? 'text-green-400 bg-green-400/10' : 'text-[var(--color-text-secondary)] bg-[var(--color-text-secondary)]/10'
                    }`}>
                        {isOpen ? 'LIVE' : 'RESOLVED'}
                    </span>
                </div>

                <div className="mb-6">
                    <div className="flex justify-between text-base mb-2">
                        <span className="text-green-400 font-bold">YES {yesPercent.toFixed(1)}%</span>
                        <span className="text-red-400 font-bold">NO {noPercent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-4 bg-red-500/30 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-500 rounded-full transition-all duration-700"
                            style={{ width: `${yesPercent}%` }}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm text-[var(--color-text-secondary)] mb-6">
                    <div>
                        <span className="block text-xs uppercase tracking-wider mb-1">YES Pool</span>
                        <span className="text-green-400 font-semibold text-base">{formatSats(market.yesPool)}</span>
                    </div>
                    <div className="text-right">
                        <span className="block text-xs uppercase tracking-wider mb-1">NO Pool</span>
                        <span className="text-red-400 font-semibold text-base">{formatSats(market.noPool)}</span>
                    </div>
                    <div>
                        <span className="block text-xs uppercase tracking-wider mb-1">Total Pool</span>
                        <span className="text-[var(--color-btc-orange)] font-semibold text-base">{formatSats(totalPool)}</span>
                    </div>
                    <div className="text-right">
                        <span className="block text-xs uppercase tracking-wider mb-1">Ends at Block</span>
                        <span className="text-[var(--color-text-primary)] font-semibold text-base">#{market.endBlock.toLocaleString()}</span>
                    </div>
                </div>

                {isResolved && (
                    <div className={`text-center py-4 rounded-xl mb-4 ${
                        market.outcome === MarketOutcome.YES
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-red-500/10 text-red-400'
                    }`}>
                        <span className="text-lg font-bold">
                            Resolved: {market.outcome === MarketOutcome.YES ? 'YES' : 'NO'}
                        </span>
                    </div>
                )}
            </Card>

            {isOpen && deadlineReached && (
                <Card>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                        Betting is closed — the deadline (block #{market.endBlock.toLocaleString()}) has passed. Awaiting oracle resolution.
                    </p>
                </Card>
            )}

            {isOpen && address && !deadlineReached && (
                <Card>
                    <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">Place Your Bet</h2>
                    <div className="mb-4">
                        <label className="block text-sm text-[var(--color-text-secondary)] mb-2">Bet Amount (sats)</label>
                        <input
                            type="number"
                            value={betAmount}
                            onChange={(e) => setBetAmount(e.target.value)}
                            min="1"
                            className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-btc-orange)] focus:outline-none transition-colors"
                            placeholder="10000"
                        />
                    </div>
                    <div className="flex gap-4">
                        <Button
                            variant="yes"
                            size="lg"
                            className="flex-1"
                            onClick={() => handleBet(MarketOutcome.YES)}
                            disabled={loading}
                        >
                            {loading ? 'Placing...' : `Bet YES (${yesPercent.toFixed(0)}%)`}
                        </Button>
                        <Button
                            variant="no"
                            size="lg"
                            className="flex-1"
                            onClick={() => handleBet(MarketOutcome.NO)}
                            disabled={loading}
                        >
                            {loading ? 'Placing...' : `Bet NO (${noPercent.toFixed(0)}%)`}
                        </Button>
                    </div>
                    {error && errorSource === 'bet' && (
                        <div className="mt-3 text-red-400 text-sm bg-red-400/10 px-4 py-3 rounded-lg">
                            {error}
                        </div>
                    )}
                    {betSuccess && !error && (
                        <div className="mt-3 text-green-400 text-sm bg-green-400/10 px-4 py-3 rounded-lg">
                            Bet submitted! It will be reflected after the next block confirmation (~10 min).
                        </div>
                    )}
                </Card>
            )}

            {pendingTxs.length > 0 && (
                <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-[var(--color-btc-orange)]/5 animate-pulse pointer-events-none" />
                    <div className="relative">
                        <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                            Pending Bets
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-[var(--color-btc-orange)] bg-[var(--color-btc-orange)]/10 animate-pulse">
                                {pendingTxs.length}
                            </span>
                        </h2>
                        <p className="text-xs text-[var(--color-text-muted)] mb-4">
                            Unconfirmed bets on this market. They will be reflected after the next block (~10 min).
                        </p>
                        <div className="space-y-3">
                            {pendingTxs.map((tx) => (
                                <div
                                    key={tx.txId}
                                    className="bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-4 py-3"
                                >
                                    <p className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                                        {pendingLabel(tx)}
                                    </p>
                                    <div className="flex items-center justify-between text-sm mb-1">
                                        <span className="text-[var(--color-text-muted)]">TxID</span>
                                        <span className="font-mono text-[var(--color-text-secondary)]">{truncateId(tx.txId)}</span>
                                    </div>
                                    {tx.from && (
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <span className="text-[var(--color-text-muted)]">From</span>
                                            <span className="font-mono text-[var(--color-text-secondary)]">{truncateId(tx.from)}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-[var(--color-text-muted)]">Seen</span>
                                        <span className="text-[var(--color-text-secondary)]">{timeAgo(tx.firstSeen)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>
            )}

            {position && (position.yesBet > 0n || position.noBet > 0n) && (
                <Card>
                    <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">Your Position</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="block text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">Your YES Bet</span>
                            <span className="text-green-400 font-semibold">{formatSats(position.yesBet)}</span>
                        </div>
                        <div>
                            <span className="block text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">Your NO Bet</span>
                            <span className="text-red-400 font-semibold">{formatSats(position.noBet)}</span>
                        </div>
                    </div>

                    {isResolved && !position.claimed && (
                        <>
                            <Button
                                variant="primary"
                                size="lg"
                                className="w-full mt-4"
                                onClick={handleClaim}
                                disabled={loading}
                            >
                                {loading ? 'Claiming...' : 'Claim Winnings'}
                            </Button>
                            {error && errorSource === 'claim' && (
                                <div className="mt-3 text-red-400 text-sm bg-red-400/10 px-4 py-3 rounded-lg">
                                    {error}
                                </div>
                            )}
                        </>
                    )}

                    {position.claimed && (
                        <p className="text-center mt-4 text-[var(--color-text-secondary)]">Winnings already claimed</p>
                    )}
                </Card>
            )}

            {isOpen && (
                <Card>
                    <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">Oracle Resolution</h2>
                    {!address ? (
                        <div className="text-sm text-[var(--color-text-secondary)]">
                            <p className="mb-3">Connect your wallet to check if you are the oracle for this market.</p>
                            <div className="bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-4 py-3">
                                <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] block mb-1">Oracle Address</span>
                                <span className="text-[var(--color-text-primary)] font-mono text-sm break-all">{market.oracle}</span>
                            </div>
                        </div>
                    ) : isOracle ? (
                        <>
                            {!deadlineReached ? (
                                <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                                    Resolution will be available after block #{market.endBlock.toLocaleString()}.
                                    {currentBlock !== null && (
                                        <span className="text-[var(--color-text-muted)]">
                                            {' '}(current: #{currentBlock.toLocaleString()})
                                        </span>
                                    )}
                                </p>
                            ) : (
                                <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                                    The deadline has passed. You can now resolve this market.
                                </p>
                            )}
                            <div className="flex gap-4">
                                <Button
                                    variant="yes"
                                    size="md"
                                    className="flex-1"
                                    onClick={() => handleResolve(MarketOutcome.YES)}
                                    disabled={loading || !deadlineReached}
                                >
                                    Resolve YES
                                </Button>
                                <Button
                                    variant="no"
                                    size="md"
                                    className="flex-1"
                                    onClick={() => handleResolve(MarketOutcome.NO)}
                                    disabled={loading || !deadlineReached}
                                >
                                    Resolve NO
                                </Button>
                            </div>
                            {error && errorSource === 'resolve' && (
                                <div className="mt-3 text-red-400 text-sm bg-red-400/10 px-4 py-3 rounded-lg">
                                    {error}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-sm text-[var(--color-text-secondary)]">
                            <p className="mb-2">
                                This market can only be resolved by the designated oracle after the deadline.
                            </p>
                            <div className="bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-4 py-3">
                                <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] block mb-1">Oracle Address</span>
                                <span className="text-[var(--color-text-primary)] font-mono text-sm break-all">{market.oracle}</span>
                            </div>
                            {currentBlock !== null && !deadlineReached && (
                                <p className="mt-3 text-[var(--color-text-muted)] text-xs">
                                    Deadline: block #{market.endBlock.toLocaleString()} (current: #{currentBlock.toLocaleString()})
                                </p>
                            )}
                            {deadlineReached && (
                                <p className="mt-3 text-[var(--color-btc-orange)] text-xs">
                                    Deadline reached. Waiting for oracle to resolve.
                                </p>
                            )}
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}
