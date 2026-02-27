interface CoinEntry {
    id: string;
    symbol: string;
    name: string;
}

let coins: CoinEntry[] = [];
let loaded = false;
let loading: Promise<void> | null = null;

// Popular coins shown before CoinGecko loads or as fallback
const POPULAR_COINS: CoinEntry[] = [
    { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
    { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
    { id: 'solana', symbol: 'sol', name: 'Solana' },
    { id: 'ripple', symbol: 'xrp', name: 'XRP' },
    { id: 'cardano', symbol: 'ada', name: 'Cardano' },
    { id: 'dogecoin', symbol: 'doge', name: 'Dogecoin' },
    { id: 'polkadot', symbol: 'dot', name: 'Polkadot' },
    { id: 'avalanche-2', symbol: 'avax', name: 'Avalanche' },
    { id: 'chainlink', symbol: 'link', name: 'Chainlink' },
    { id: 'uniswap', symbol: 'uni', name: 'Uniswap' },
    { id: 'cosmos', symbol: 'atom', name: 'Cosmos' },
    { id: 'litecoin', symbol: 'ltc', name: 'Litecoin' },
    { id: 'near', symbol: 'near', name: 'NEAR Protocol' },
    { id: 'aptos', symbol: 'apt', name: 'Aptos' },
    { id: 'arbitrum', symbol: 'arb', name: 'Arbitrum' },
    { id: 'optimism', symbol: 'op', name: 'Optimism' },
    { id: 'sui', symbol: 'sui', name: 'Sui' },
    { id: 'sei-network', symbol: 'sei', name: 'Sei' },
    { id: 'celestia', symbol: 'tia', name: 'Celestia' },
    { id: 'injective-protocol', symbol: 'inj', name: 'Injective' },
    { id: 'fetch-ai', symbol: 'fet', name: 'Fetch.ai' },
    { id: 'render-token', symbol: 'rndr', name: 'Render' },
    { id: 'blockstack', symbol: 'stx', name: 'Stacks' },
    { id: 'thorchain', symbol: 'rune', name: 'THORChain' },
    { id: 'pepe', symbol: 'pepe', name: 'Pepe' },
    { id: 'dogwifcoin', symbol: 'wif', name: 'dogwifhat' },
    { id: 'bonk', symbol: 'bonk', name: 'Bonk' },
];

// Well-known coin IDs to prefer when deduping (CoinGecko has many obscure coins with the same symbol)
const WELL_KNOWN_IDS = new Set(POPULAR_COINS.map((c) => c.id));

async function fetchCoinList(): Promise<void> {
    try {
        const resp = await fetch('https://api.coingecko.com/api/v3/coins/list');
        if (!resp.ok) return;
        const data: CoinEntry[] = await resp.json();
        if (Array.isArray(data) && data.length > 100) {
            coins = data;
            loaded = true;
        }
    } catch {
        // CoinGecko unavailable — keep fallback
    }
}

export function bootCoinList(): void {
    if (loading) return;
    loading = fetchCoinList();
}

export function searchCoins(query: string, limit = 12): { symbol: string; name: string }[] {
    const source = loaded ? coins : POPULAR_COINS;
    if (!query) {
        return POPULAR_COINS.slice(0, limit).map((c) => ({
            symbol: c.symbol.toUpperCase(),
            name: c.name,
        }));
    }

    const q = query.toLowerCase();

    // Two-pass: first collect symbol matches (exact + prefix), then name matches
    const exact: { symbol: string; name: string; score: number }[] = [];
    const symPrefix: { symbol: string; name: string; score: number }[] = [];
    const namePrefix: { symbol: string; name: string; score: number }[] = [];
    const nameContains: { symbol: string; name: string; score: number }[] = [];

    for (const c of source) {
        const sym = c.symbol.toLowerCase();
        const name = c.name.toLowerCase();
        const isWellKnown = WELL_KNOWN_IDS.has(c.id);

        if (sym === q) {
            // Well-known coins get score -1 to always sort first among exact matches
            exact.push({ symbol: c.symbol.toUpperCase(), name: c.name, score: isWellKnown ? -1 : 0 });
        } else if (sym.startsWith(q)) {
            if (symPrefix.length < limit) {
                symPrefix.push({ symbol: c.symbol.toUpperCase(), name: c.name, score: 1 });
            }
        } else if (name.startsWith(q)) {
            if (namePrefix.length < limit) {
                namePrefix.push({ symbol: c.symbol.toUpperCase(), name: c.name, score: 2 });
            }
        } else if (name.includes(q)) {
            if (nameContains.length < limit) {
                nameContains.push({ symbol: c.symbol.toUpperCase(), name: c.name, score: 3 });
            }
        }

        // Stop early if we have plenty of high-quality results
        if (exact.length + symPrefix.length >= limit) break;
    }

    const all = [...exact, ...symPrefix, ...namePrefix, ...nameContains];

    // Dedupe by symbol (keep best score)
    const seen = new Map<string, { symbol: string; name: string; score: number }>();
    for (const r of all) {
        const existing = seen.get(r.symbol);
        if (!existing || r.score < existing.score) {
            seen.set(r.symbol, r);
        }
    }

    return Array.from(seen.values())
        .sort((a, b) => a.score - b.score)
        .slice(0, limit)
        .map(({ symbol, name }) => ({ symbol, name }));
}
