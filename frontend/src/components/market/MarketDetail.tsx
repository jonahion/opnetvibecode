import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { usePredictionMarket } from '../../hooks/usePredictionMarket';
import { MarketData, MarketStatus, MarketOutcome, UserPosition } from '../../types';

function formatSats(sats: bigint): string {
    const btc = Number(sats) / 100_000_000;
    if (btc >= 0.001) return `${btc.toFixed(4)} BTC`;
    return `${sats.toLocaleString()} sats`;
}

export function MarketDetail(): React.JSX.Element {
    const { id } = useParams<{ id: string }>();
    const { address } = useWalletConnect();
    const {
        fetchMarket,
        fetchUserPosition,
        placeBet,
        resolveMarket,
        claimWinnings,
        loading,
        error,
    } = usePredictionMarket();

    const [market, setMarket] = useState<MarketData | null>(null);
    const [position, setPosition] = useState<UserPosition | null>(null);
    const [loadingData, setLoadingData] = useState(true);
    const [betAmount, setBetAmount] = useState('10000');
    const [errorSource, setErrorSource] = useState<'bet' | 'resolve' | 'claim' | null>(null);

    const marketId = BigInt(id ?? '0');

    const loadData = useCallback(async (): Promise<void> => {
        setLoadingData(true);
        try {
            const m = await fetchMarket(marketId);
            setMarket(m);
            if (address) {
                const p = await fetchUserPosition(marketId);
                setPosition(p);
            }
        } catch {
            // error handled by hook
        } finally {
            setLoadingData(false);
        }
    }, [marketId, address, fetchMarket, fetchUserPosition]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const handleBet = async (outcome: MarketOutcome): Promise<void> => {
        setErrorSource('bet');
        try {
            const amount = BigInt(betAmount);
            await placeBet(marketId, outcome, amount);
            setErrorSource(null);
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
                <div className="animate-pulse text-[#f7931a] text-lg">Loading market...</div>
            </div>
        );
    }

    if (!market) {
        return (
            <Card className="max-w-2xl mx-auto text-center">
                <p className="text-[#8888a0]">Market not found</p>
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

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <Card>
                <div className="flex items-start justify-between mb-6">
                    <h1 className="text-2xl font-bold text-[#e4e4ec] leading-snug flex-1">
                        {market.question}
                    </h1>
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full shrink-0 ml-4 ${
                        isOpen ? 'text-green-400 bg-green-400/10' : 'text-[#8888a0] bg-[#8888a0]/10'
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

                <div className="grid grid-cols-2 gap-4 text-sm text-[#8888a0] mb-6">
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
                        <span className="text-[#f7931a] font-semibold text-base">{formatSats(totalPool)}</span>
                    </div>
                    <div className="text-right">
                        <span className="block text-xs uppercase tracking-wider mb-1">Ends at Block</span>
                        <span className="text-[#e4e4ec] font-semibold text-base">#{market.endBlock.toLocaleString()}</span>
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

            {isOpen && address && (
                <Card>
                    <h2 className="text-lg font-bold text-[#e4e4ec] mb-4">Place Your Bet</h2>
                    <div className="mb-4">
                        <label className="block text-sm text-[#8888a0] mb-2">Bet Amount (sats)</label>
                        <input
                            type="number"
                            value={betAmount}
                            onChange={(e) => setBetAmount(e.target.value)}
                            min="1"
                            className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl px-4 py-3 text-[#e4e4ec] placeholder-[#555] focus:border-[#f7931a] focus:outline-none transition-colors"
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
                </Card>
            )}

            {position && (position.yesBet > 0n || position.noBet > 0n) && (
                <Card>
                    <h2 className="text-lg font-bold text-[#e4e4ec] mb-4">Your Position</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="block text-xs uppercase tracking-wider text-[#8888a0] mb-1">Your YES Bet</span>
                            <span className="text-green-400 font-semibold">{formatSats(position.yesBet)}</span>
                        </div>
                        <div>
                            <span className="block text-xs uppercase tracking-wider text-[#8888a0] mb-1">Your NO Bet</span>
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
                        <p className="text-center mt-4 text-[#8888a0]">Winnings already claimed</p>
                    )}
                </Card>
            )}

            {isOpen && (
                <Card>
                    <h2 className="text-lg font-bold text-[#e4e4ec] mb-4">Oracle Resolution</h2>
                    <p className="text-sm text-[#8888a0] mb-4">
                        Only the designated oracle can resolve this market after the end block.
                    </p>
                    <div className="flex gap-4">
                        <Button
                            variant="yes"
                            size="md"
                            className="flex-1"
                            onClick={() => handleResolve(MarketOutcome.YES)}
                            disabled={loading}
                        >
                            Resolve YES
                        </Button>
                        <Button
                            variant="no"
                            size="md"
                            className="flex-1"
                            onClick={() => handleResolve(MarketOutcome.NO)}
                            disabled={loading}
                        >
                            Resolve NO
                        </Button>
                    </div>
                    {error && errorSource === 'resolve' && (
                        <div className="mt-3 text-red-400 text-sm bg-red-400/10 px-4 py-3 rounded-lg">
                            {error}
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}
