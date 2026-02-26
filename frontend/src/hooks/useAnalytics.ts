import { useState, useCallback, useMemo, useRef } from 'react';
import { usePredictionMarket } from './usePredictionMarket';
import { MarketData, MarketStatus, MarketOutcome } from '../types';

const CACHE_KEY = 'oprophet_analytics_cache';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

interface CacheEntry {
    timestamp: number;
    // bigints serialized as strings
    markets: Array<Omit<MarketData, 'id' | 'endBlock' | 'yesPool' | 'noPool'> & {
        id: string; endBlock: string; yesPool: string; noPool: string;
    }>;
}

function loadCache(): MarketData[] | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const entry = JSON.parse(raw) as CacheEntry;
        if (Date.now() - entry.timestamp > CACHE_TTL) {
            localStorage.removeItem(CACHE_KEY);
            return null;
        }
        return entry.markets.map((m) => ({
            ...m,
            id: BigInt(m.id),
            endBlock: BigInt(m.endBlock),
            yesPool: BigInt(m.yesPool),
            noPool: BigInt(m.noPool),
        }));
    } catch {
        return null;
    }
}

function saveCache(markets: MarketData[]): void {
    try {
        const entry: CacheEntry = {
            timestamp: Date.now(),
            markets: markets.map((m) => ({
                ...m,
                id: m.id.toString(),
                endBlock: m.endBlock.toString(),
                yesPool: m.yesPool.toString(),
                noPool: m.noPool.toString(),
            })),
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch {
        // quota exceeded or other error
    }
}

export interface MarketAnalytics {
    id: bigint;
    question: string;
    status: MarketStatus;
    outcome: MarketOutcome;
    yesPool: bigint;
    noPool: bigint;
    totalPool: bigint;
    yesPercent: number;
    noPercent: number;
    endBlock: bigint;
    creator: string;
    oracle: string;
}

export interface WalletStats {
    address: string;
    marketsCreated: number;
    marketsAsOracle: number;
    totalActivity: number;
}

export interface OverviewStats {
    totalMarkets: number;
    openMarkets: number;
    resolvedMarkets: number;
    totalVolume: bigint;
    totalYesVolume: bigint;
    totalNoVolume: bigint;
    avgPoolSize: bigint;
    largestPool: bigint;
    resolvedYes: number;
    resolvedNo: number;
}

export interface AnalyticsData {
    markets: MarketAnalytics[];
    wallets: WalletStats[];
    overview: OverviewStats;
    poolDistribution: { name: string; value: number }[];
    statusDistribution: { name: string; value: number; color: string }[];
    outcomeDistribution: { name: string; value: number; color: string }[];
    volumeByMarket: { name: string; yes: number; no: number; total: number }[];
}

export function useAnalytics(): {
    data: AnalyticsData | null;
    loading: boolean;
    error: string | null;
    refresh: (force?: boolean) => Promise<void>;
} {
    const { fetchMarketCount, fetchMarket } = usePredictionMarket();
    const [rawMarkets, setRawMarkets] = useState<MarketData[]>(() => loadCache() ?? []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastFetch = useRef(0);

    const refresh = useCallback(async (force = false): Promise<void> => {
        // Skip if recently fetched (within cache TTL) unless forced
        if (!force && Date.now() - lastFetch.current < CACHE_TTL && rawMarkets.length > 0) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const count = await fetchMarketCount();
            const markets: MarketData[] = [];
            for (let i = 1n; i <= count; i++) {
                try {
                    markets.push(await fetchMarket(i));
                } catch {
                    // skip individual errors
                }
            }
            setRawMarkets(markets);
            saveCache(markets);
            lastFetch.current = Date.now();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    }, [fetchMarketCount, fetchMarket, rawMarkets.length]);

    const data = useMemo((): AnalyticsData | null => {
        if (rawMarkets.length === 0) return null;

        const markets: MarketAnalytics[] = rawMarkets.map((m) => {
            const totalPool = m.yesPool + m.noPool;
            const yesPercent = totalPool > 0n
                ? Number((m.yesPool * 10000n) / totalPool) / 100
                : 50;
            return {
                ...m,
                totalPool,
                yesPercent,
                noPercent: totalPool > 0n ? 100 - yesPercent : 50,
            };
        });

        const openMarkets = markets.filter((m) => m.status === MarketStatus.OPEN).length;
        const resolvedMarkets = markets.filter((m) => m.status === MarketStatus.RESOLVED).length;
        const totalVolume = markets.reduce((acc, m) => acc + m.totalPool, 0n);
        const totalYesVolume = markets.reduce((acc, m) => acc + m.yesPool, 0n);
        const totalNoVolume = markets.reduce((acc, m) => acc + m.noPool, 0n);
        const avgPoolSize = markets.length > 0 ? totalVolume / BigInt(markets.length) : 0n;
        const largestPool = markets.reduce((max, m) => m.totalPool > max ? m.totalPool : max, 0n);
        const resolvedYes = markets.filter((m) => m.outcome === MarketOutcome.YES).length;
        const resolvedNo = markets.filter((m) => m.outcome === MarketOutcome.NO).length;

        const overview: OverviewStats = {
            totalMarkets: markets.length,
            openMarkets,
            resolvedMarkets,
            totalVolume,
            totalYesVolume,
            totalNoVolume,
            avgPoolSize,
            largestPool,
            resolvedYes,
            resolvedNo,
        };

        // Wallet aggregation
        const walletMap = new Map<string, WalletStats>();
        const getOrCreate = (addr: string): WalletStats => {
            if (!walletMap.has(addr)) {
                walletMap.set(addr, { address: addr, marketsCreated: 0, marketsAsOracle: 0, totalActivity: 0 });
            }
            return walletMap.get(addr)!;
        };
        for (const m of markets) {
            const creator = getOrCreate(m.creator);
            creator.marketsCreated++;
            creator.totalActivity++;
            const oracle = getOrCreate(m.oracle);
            oracle.marketsAsOracle++;
            if (m.oracle !== m.creator) oracle.totalActivity++;
        }
        const wallets = Array.from(walletMap.values()).sort((a, b) => b.totalActivity - a.totalActivity);

        // Chart data
        const poolDistribution = markets.map((m) => ({
            name: `#${m.id}`,
            value: Number(m.totalPool),
        }));

        const statusDistribution = [
            { name: 'Open', value: openMarkets, color: '#22c55e' },
            { name: 'Resolved', value: resolvedMarkets, color: '#8888a0' },
        ].filter((d) => d.value > 0);

        const outcomeDistribution = [
            { name: 'YES', value: resolvedYes, color: '#22c55e' },
            { name: 'NO', value: resolvedNo, color: '#ef4444' },
            { name: 'Pending', value: openMarkets, color: '#f7931a' },
        ].filter((d) => d.value > 0);

        const volumeByMarket = markets.map((m) => ({
            name: `#${m.id}`,
            yes: Number(m.yesPool),
            no: Number(m.noPool),
            total: Number(m.totalPool),
        }));

        return {
            markets,
            wallets,
            overview,
            poolDistribution,
            statusDistribution,
            outcomeDistribution,
            volumeByMarket,
        };
    }, [rawMarkets]);

    return { data, loading, error, refresh };
}
