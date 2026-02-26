import { useEffect, useState, useCallback } from 'react';
import { usePredictionMarket } from '../../hooks/usePredictionMarket';
import { MarketCard } from './MarketCard';
import { MarketData } from '../../types';

export function MarketList(): React.JSX.Element {
    const { fetchMarketCount, fetchMarket } = usePredictionMarket();
    const [markets, setMarkets] = useState<MarketData[]>([]);
    const [loading, setLoading] = useState(true);

    const loadMarkets = useCallback(async (): Promise<void> => {
        setLoading(true);
        try {
            const count = await fetchMarketCount();
            const fetched: MarketData[] = [];

            const MAX_DISPLAY = 50;
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
            <div className="grid gap-4 md:grid-cols-2">
                {markets.map((market) => (
                    <MarketCard key={market.id.toString()} market={market} />
                ))}
            </div>
        </div>
    );
}
