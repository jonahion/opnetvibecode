import { MarketAnalytics } from '../hooks/useAnalytics';

interface FilterParams {
    markets: MarketAnalytics[];
    search?: string;
    blockRange?: { from: string; to: string };
    dateRange?: { from: string; to: string };
    // Reference block for date conversion (latest endBlock from all markets)
    referenceBlock?: bigint;
}

// OPNet: ~10 min per block
const BLOCK_TIME_MS = 10 * 60 * 1000;

function dateToBlock(dateStr: string, refBlock: bigint, addEndOfDay: boolean): bigint {
    const d = new Date(addEndOfDay ? dateStr + 'T23:59:59' : dateStr);
    if (isNaN(d.getTime())) return 0n;
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffBlocks = Math.floor(diffMs / BLOCK_TIME_MS);
    const result = refBlock + BigInt(diffBlocks);
    return result > 0n ? result : 0n;
}

export function filterMarkets({
    markets,
    search,
    blockRange,
    dateRange,
    referenceBlock,
}: FilterParams): MarketAnalytics[] {
    let filtered = markets;

    if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
            (m) =>
                m.question.toLowerCase().includes(q) ||
                m.creator.toLowerCase().includes(q) ||
                m.oracle.toLowerCase().includes(q) ||
                `#${m.id}`.includes(q),
        );
    }

    if (blockRange?.from) {
        const from = BigInt(blockRange.from);
        filtered = filtered.filter((m) => m.endBlock >= from);
    }
    if (blockRange?.to) {
        const to = BigInt(blockRange.to);
        filtered = filtered.filter((m) => m.endBlock <= to);
    }

    if (dateRange?.from || dateRange?.to) {
        const refBlock = referenceBlock ?? (markets.length > 0
            ? markets.reduce((max, m) => m.endBlock > max ? m.endBlock : max, 0n)
            : 2300n);

        if (dateRange.from) {
            const fromBlock = dateToBlock(dateRange.from, refBlock, false);
            if (fromBlock > 0n) filtered = filtered.filter((m) => m.endBlock >= fromBlock);
        }
        if (dateRange.to) {
            const toBlock = dateToBlock(dateRange.to, refBlock, true);
            if (toBlock > 0n) filtered = filtered.filter((m) => m.endBlock <= toBlock);
        }
    }

    return filtered;
}
