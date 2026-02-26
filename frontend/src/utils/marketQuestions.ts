import { supabase } from '../services/supabase';

// In-memory cache so synchronous getMarketTitle() always returns fast
const cache = new Map<string, string>();

// Boot: load all questions from Supabase into memory
let booted = false;
export async function bootMarketQuestions(): Promise<void> {
    if (booted) return;
    booted = true;
    try {
        const { data } = await supabase
            .from('market_questions')
            .select('market_id, question');
        if (data) {
            for (const row of data) {
                cache.set(String(row.market_id), row.question as string);
            }
        }
    } catch {
        // Supabase unavailable — cache stays empty
    }
}

export async function saveMarketQuestion(marketId: bigint, question: string): Promise<void> {
    const key = marketId.toString();
    cache.set(key, question);

    try {
        await supabase
            .from('market_questions')
            .upsert({ market_id: Number(marketId), question }, { onConflict: 'market_id' });
    } catch {
        // best-effort
    }
}

export function getMarketQuestion(marketId: bigint): string | null {
    return cache.get(marketId.toString()) ?? null;
}

export function getMarketTitle(marketId: bigint, fallback?: string): string {
    return getMarketQuestion(marketId) ?? fallback ?? `Market #${marketId}`;
}
