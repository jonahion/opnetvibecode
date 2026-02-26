import { supabase } from '../services/supabase';
import { MarketMetadata } from '../types';

interface MarketQuestionEntry {
    question: string;
    coin?: string;
    targetPrice?: number;
    deadline?: string;
}

// In-memory cache so synchronous getMarketTitle() always returns fast
const cache = new Map<string, MarketQuestionEntry>();

// Boot: load all questions from Supabase into memory
let booted = false;
export async function bootMarketQuestions(): Promise<void> {
    if (booted) return;
    booted = true;
    try {
        // Try with metadata columns first; fall back to question-only if columns don't exist yet
        const { data, error } = await supabase
            .from('market_questions')
            .select('market_id, question, coin, target_price, deadline');
        if (error && error.code === '42703') {
            // Columns don't exist yet — load question-only
            const { data: fallback } = await supabase
                .from('market_questions')
                .select('market_id, question');
            if (fallback) {
                for (const row of fallback) {
                    cache.set(String(row.market_id), { question: row.question as string });
                }
            }
            return;
        }
        if (data) {
            for (const row of data) {
                cache.set(String(row.market_id), {
                    question: row.question as string,
                    coin: (row.coin as string) || undefined,
                    targetPrice: (row.target_price as number) || undefined,
                    deadline: (row.deadline as string) || undefined,
                });
            }
        }
    } catch {
        // Supabase unavailable — cache stays empty
    }
}

export async function saveMarketQuestion(
    marketId: bigint,
    question: string,
    metadata?: MarketMetadata,
): Promise<void> {
    const key = marketId.toString();
    cache.set(key, {
        question,
        coin: metadata?.coin,
        targetPrice: metadata?.targetPrice,
        deadline: metadata?.deadline,
    });

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row: Record<string, any> = {
            market_id: Number(marketId),
            question,
        };
        if (metadata) {
            row.coin = metadata.coin;
            row.target_price = metadata.targetPrice;
            row.deadline = metadata.deadline;
        }
        const { error } = await supabase
            .from('market_questions')
            .upsert(row, { onConflict: 'market_id' });
        // If metadata columns don't exist yet, retry without them
        if (error && error.code === '42703' && metadata) {
            await supabase
                .from('market_questions')
                .upsert({ market_id: Number(marketId), question }, { onConflict: 'market_id' });
        }
    } catch {
        // best-effort
    }
}

export function getMarketQuestion(marketId: bigint): string | null {
    return cache.get(marketId.toString())?.question ?? null;
}

export function getMarketTitle(marketId: bigint, fallback?: string): string {
    return getMarketQuestion(marketId) ?? fallback ?? `Market #${marketId}`;
}

export function getMarketMetadata(marketId: bigint): MarketMetadata | null {
    const entry = cache.get(marketId.toString());
    if (!entry?.coin) return null;
    return {
        coin: entry.coin,
        targetPrice: entry.targetPrice ?? 0,
        deadline: entry.deadline ?? '',
    };
}

export function getAllMarketMetadata(): Map<string, MarketMetadata> {
    const result = new Map<string, MarketMetadata>();
    for (const [id, entry] of cache) {
        if (entry.coin) {
            result.set(id, {
                coin: entry.coin,
                targetPrice: entry.targetPrice ?? 0,
                deadline: entry.deadline ?? '',
            });
        }
    }
    return result;
}
