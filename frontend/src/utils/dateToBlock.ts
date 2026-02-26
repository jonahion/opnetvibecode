// OPNet testnet: ~10 min per block
// Reference point: we'll use a rough estimate based on current block height
// This is an approximation — exact block times vary

const BLOCK_TIME_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Convert a date string (YYYY-MM-DD) to an approximate block number.
 * Uses the estimated relationship between dates and blocks.
 * referenceBlock + (dateMs - referenceMs) / blockTimeMs
 */
export function dateToApproxBlock(
    dateStr: string,
    referenceBlock: bigint,
    referenceDate: Date,
): bigint {
    const targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) return 0n;
    const diffMs = targetDate.getTime() - referenceDate.getTime();
    const diffBlocks = Math.floor(diffMs / BLOCK_TIME_MS);
    const result = referenceBlock + BigInt(diffBlocks);
    return result > 0n ? result : 0n;
}

/**
 * Filter markets by date range using end block approximation.
 * Uses the earliest and latest endBlock from markets as reference points.
 */
export function getDateBlockRange(
    dateFrom: string,
    dateTo: string,
    currentBlock: bigint,
): { from: bigint | null; to: bigint | null } {
    const now = new Date();
    const from = dateFrom ? dateToApproxBlock(dateFrom, currentBlock, now) : null;
    const to = dateTo ? dateToApproxBlock(dateTo + 'T23:59:59', currentBlock, now) : null;
    return { from, to };
}
