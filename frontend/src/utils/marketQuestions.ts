const STORAGE_KEY = 'oprophet_market_questions';

function getStore(): Record<string, string> {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, string>;
    } catch {
        return {};
    }
}

export function saveMarketQuestion(marketId: bigint, question: string): void {
    const store = getStore();
    store[marketId.toString()] = question;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getMarketQuestion(marketId: bigint): string | null {
    const store = getStore();
    return store[marketId.toString()] ?? null;
}

export function getMarketTitle(marketId: bigint, fallback?: string): string {
    return getMarketQuestion(marketId) ?? fallback ?? `Market #${marketId}`;
}
