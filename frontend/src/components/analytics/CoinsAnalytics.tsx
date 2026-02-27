import { useMemo, useState, useRef, useEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
    BarChart, Bar,
    Treemap,
} from 'recharts';
import { Card } from '../common/Card';
import { AnalyticsData, MarketAnalytics } from '../../hooks/useAnalytics';
import { MarketStatus } from '../../types';
import { filterMarkets } from '../../utils/filterMarkets';
import { getAllMarketMetadata } from '../../utils/marketQuestions';
import { searchCoins } from '../../utils/coinList';

interface Props {
    data: AnalyticsData;
    search: string;
    blockRange: { from: string; to: string };
    dateRange: { from: string; to: string };
}

function formatSats(sats: bigint | number): string {
    const n = typeof sats === 'bigint' ? Number(sats) : sats;
    const btc = n / 100_000_000;
    if (btc >= 0.001) return `${btc.toFixed(4)} BTC`;
    return `${n.toLocaleString()} sats`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any): React.JSX.Element | null {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[var(--color-bg-card-hover)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs">
            <p className="text-[var(--color-text-primary)] font-medium mb-1">{label}</p>
            {payload.map((p: { name: string; value: number; color: string }, i: number) => (
                <p key={i} style={{ color: p.color }}>
                    {p.name}: {formatSats(p.value)}
                </p>
            ))}
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TreemapContent({ x, y, width, height, name, value }: any): React.JSX.Element | null {
    if (width < 40 || height < 30) return null;
    return (
        <g>
            <rect x={x} y={y} width={width} height={height} rx={4} fill="#f7931a" fillOpacity={0.7} stroke="#0a0a0f" strokeWidth={2} />
            <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill="#e4e4ec" fontSize={11} fontWeight="bold">
                {name}
            </text>
            <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="#8888a0" fontSize={9}>
                {formatSats(value as number)}
            </text>
        </g>
    );
}

function CoinFilter({ value, onChange }: { value: string; onChange: (v: string) => void }): React.JSX.Element {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const suggestions = searchCoins(value, 8);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <input
                type="text"
                value={value}
                onChange={(e) => { onChange(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                placeholder="Filter by coin (e.g. BTC, ETH)..."
                className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-btc-orange)] focus:outline-none transition-colors"
            />
            {open && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-bg-card-hover)] border border-[var(--color-border)] rounded-xl overflow-hidden z-10 shadow-lg max-h-64 overflow-y-auto">
                    {suggestions.map((coin) => (
                        <button
                            key={coin.symbol}
                            onClick={() => { onChange(coin.symbol); setOpen(false); }}
                            className="w-full text-left px-4 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-btc-orange)]/10 hover:text-[var(--color-btc-orange)] transition-colors cursor-pointer flex items-center justify-between"
                        >
                            <span className="font-medium">{coin.symbol}</span>
                            <span className="text-xs text-[var(--color-text-muted)]">{coin.name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export function CoinsAnalytics({ data, search, blockRange, dateRange }: Props): React.JSX.Element {
    const [coinFilter, setCoinFilter] = useState('');

    const metadataMap = useMemo(() => getAllMarketMetadata(), [data.markets]);

    const filtered = useMemo((): MarketAnalytics[] => {
        let markets = filterMarkets({ markets: data.markets, search, blockRange, dateRange });
        // Only show price prediction markets (those with coin metadata)
        markets = markets.filter((m) => {
            const meta = metadataMap.get(m.id.toString());
            return meta?.coin;
        });
        // Additional coin filter
        if (coinFilter) {
            const q = coinFilter.toUpperCase();
            markets = markets.filter((m) => {
                const meta = metadataMap.get(m.id.toString());
                return meta?.coin?.toUpperCase() === q;
            });
        }
        return markets;
    }, [data.markets, search, blockRange, dateRange, coinFilter, metadataMap]);

    const totalSats = filtered.reduce((acc, m) => acc + Number(m.totalPool), 0);
    const totalYes = filtered.reduce((acc, m) => acc + Number(m.yesPool), 0);
    const totalNo = filtered.reduce((acc, m) => acc + Number(m.noPool), 0);
    const openSats = filtered.filter((m) => m.status === MarketStatus.OPEN).reduce((acc, m) => acc + Number(m.totalPool), 0);
    const resolvedSats = filtered.filter((m) => m.status === MarketStatus.RESOLVED).reduce((acc, m) => acc + Number(m.totalPool), 0);
    const avgBetSize = filtered.length > 0 ? totalSats / filtered.length : 0;

    // Sats flow — cumulative in/out
    const satsFlow = useMemo(() => {
        let cumIn = 0;
        return filtered.map((m) => {
            cumIn += Number(m.totalPool);
            return {
                name: m.question.length > 20 ? `#${m.id}` : m.question,
                'Total Locked': cumIn,
            };
        });
    }, [filtered]);

    // YES vs NO allocation pie
    const allocationData = [
        { name: 'YES Pool', value: totalYes, color: '#22c55e' },
        { name: 'NO Pool', value: totalNo, color: '#ef4444' },
    ].filter((d) => d.value > 0);

    // Locked vs resolved pie
    const statusAllocation = [
        { name: 'Locked (Open)', value: openSats, color: '#f7931a' },
        { name: 'Settled (Resolved)', value: resolvedSats, color: '#8888a0' },
    ].filter((d) => d.value > 0);

    // Per-market sats bar (YES/NO stacked)
    const perMarketSats = filtered.map((m) => ({
        name: m.question.length > 20 ? `#${m.id}` : m.question,
        YES: Number(m.yesPool),
        NO: Number(m.noPool),
    }));

    // Treemap of pool sizes
    const treemapData = filtered
        .filter((m) => Number(m.totalPool) > 0)
        .map((m) => ({
            name: m.question.length > 20 ? `#${m.id}` : m.question,
            size: Number(m.totalPool),
        }));

    // Coin breakdown — aggregate by coin from structured metadata
    const coinBreakdown = useMemo(() => {
        const coinMap = new Map<string, { markets: number; totalPool: number; yesPool: number; noPool: number }>();
        for (const m of filtered) {
            const meta = metadataMap.get(m.id.toString());
            const coinName = meta?.coin ?? 'Other';
            const existing = coinMap.get(coinName) ?? { markets: 0, totalPool: 0, yesPool: 0, noPool: 0 };
            existing.markets++;
            existing.totalPool += Number(m.totalPool);
            existing.yesPool += Number(m.yesPool);
            existing.noPool += Number(m.noPool);
            coinMap.set(coinName, existing);
        }
        return Array.from(coinMap.entries())
            .map(([coin, stats]) => ({ coin, ...stats }))
            .sort((a, b) => b.totalPool - a.totalPool);
    }, [filtered, metadataMap]);

    // Sats concentration — top markets by %
    const concentrationData = useMemo(() => {
        if (totalSats === 0) return [];
        const sorted = [...filtered].sort((a, b) => Number(b.totalPool) - Number(a.totalPool));
        let cumPercent = 0;
        return sorted.map((m) => {
            const pct = (Number(m.totalPool) / totalSats) * 100;
            cumPercent += pct;
            return {
                id: m.id,
                question: m.question,
                totalPool: m.totalPool,
                pct: Math.round(pct * 10) / 10,
                cumPct: Math.round(cumPercent * 10) / 10,
            };
        });
    }, [filtered, totalSats]);

    return (
        <div className="space-y-6">
            {/* Coin filter */}
            <div className="max-w-sm">
                <CoinFilter value={coinFilter} onChange={setCoinFilter} />
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Total Sats</p>
                    <p className="text-xl font-bold text-[var(--color-btc-orange)]">{formatSats(totalSats)}</p>
                </div>
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">YES Pool</p>
                    <p className="text-xl font-bold text-green-400">{formatSats(totalYes)}</p>
                </div>
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">NO Pool</p>
                    <p className="text-xl font-bold text-red-400">{formatSats(totalNo)}</p>
                </div>
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Locked (Open)</p>
                    <p className="text-xl font-bold text-[var(--color-btc-orange)]">{formatSats(openSats)}</p>
                </div>
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Settled</p>
                    <p className="text-xl font-bold text-[var(--color-text-secondary)]">{formatSats(resolvedSats)}</p>
                </div>
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Avg Pool</p>
                    <p className="text-xl font-bold text-[var(--color-text-primary)]">{formatSats(avgBetSize)}</p>
                </div>
            </div>

            {/* Sats flow chart */}
            <Card>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Cumulative Sats Locked</h3>
                {satsFlow.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={satsFlow}>
                            <defs>
                                <linearGradient id="gradSats" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f7931a" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#f7931a" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="name" tick={{ fill: '#8888a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a3a' }} />
                            <YAxis tick={{ fill: '#8888a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a3a' }} />
                            <Tooltip content={<ChartTooltip />} />
                            <Area type="monotone" dataKey="Total Locked" stroke="#f7931a" fill="url(#gradSats)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-[var(--color-text-muted)] text-sm text-center py-10">No data</p>
                )}
            </Card>

            {/* Pies row */}
            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">YES / NO Allocation</h3>
                    {allocationData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie
                                    data={allocationData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={80}
                                    paddingAngle={4}
                                    dataKey="value"
                                >
                                    {allocationData.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Legend
                                    formatter={(value: string) => <span className="text-[var(--color-text-secondary)] text-xs">{value}</span>}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1a2a', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
                                    formatter={(value: number | undefined) => formatSats(value ?? 0)}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-[var(--color-text-muted)] text-sm text-center py-10">No data</p>
                    )}
                </Card>

                <Card>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Locked vs Settled</h3>
                    {statusAllocation.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie
                                    data={statusAllocation}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={80}
                                    paddingAngle={4}
                                    dataKey="value"
                                >
                                    {statusAllocation.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Legend
                                    formatter={(value: string) => <span className="text-[var(--color-text-secondary)] text-xs">{value}</span>}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1a2a', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
                                    formatter={(value: number | undefined) => formatSats(value ?? 0)}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-[var(--color-text-muted)] text-sm text-center py-10">No data</p>
                    )}
                </Card>
            </div>

            {/* Per-market bar + treemap */}
            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Sats per Market</h3>
                    {perMarketSats.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={perMarketSats}>
                                <XAxis dataKey="name" tick={{ fill: '#8888a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a3a' }} />
                                <YAxis tick={{ fill: '#8888a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a3a' }} />
                                <Tooltip content={<ChartTooltip />} />
                                <Bar dataKey="YES" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="NO" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-[var(--color-text-muted)] text-sm text-center py-10">No data</p>
                    )}
                </Card>

                <Card>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Pool Size Map</h3>
                    {treemapData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <Treemap
                                data={treemapData}
                                dataKey="size"
                                aspectRatio={4 / 3}
                                content={<TreemapContent />}
                            />
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-[var(--color-text-muted)] text-sm text-center py-10">No data</p>
                    )}
                </Card>
            </div>

            {/* Coin breakdown */}
            {coinBreakdown.length > 0 && (
                <Card>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
                        Volume by Coin
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider border-b border-[var(--color-border)]">
                                    <th className="text-left py-2 pr-3">Coin</th>
                                    <th className="text-right py-2 pr-3">Markets</th>
                                    <th className="text-right py-2 pr-3">Total Pool</th>
                                    <th className="text-right py-2 pr-3">YES</th>
                                    <th className="text-right py-2">NO</th>
                                </tr>
                            </thead>
                            <tbody>
                                {coinBreakdown.map((row) => (
                                    <tr key={row.coin} className="border-b border-[var(--color-border)]/50">
                                        <td className="py-2.5 pr-3">
                                            <span className="text-[var(--color-btc-orange)] font-semibold">{row.coin}</span>
                                        </td>
                                        <td className="py-2.5 pr-3 text-right text-[var(--color-text-primary)]">{row.markets}</td>
                                        <td className="py-2.5 pr-3 text-right text-[var(--color-text-primary)]">{formatSats(row.totalPool)}</td>
                                        <td className="py-2.5 pr-3 text-right text-green-400">{formatSats(row.yesPool)}</td>
                                        <td className="py-2.5 text-right text-red-400">{formatSats(row.noPool)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* Concentration table */}
            <Card>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
                    Sats Concentration
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider border-b border-[var(--color-border)]">
                                <th className="text-left py-2 pr-3">Market</th>
                                <th className="text-right py-2 pr-3">Pool</th>
                                <th className="text-right py-2 pr-3">% of Total</th>
                                <th className="text-right py-2">Cumulative %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {concentrationData.map((row) => (
                                <tr key={row.id.toString()} className="border-b border-[var(--color-border)]/50">
                                    <td className="py-2.5 pr-3">
                                        <span className="text-[var(--color-btc-orange)] font-medium">#{row.id.toString()}</span>
                                        <span className="text-[var(--color-text-secondary)] ml-2 text-xs">{row.question}</span>
                                    </td>
                                    <td className="py-2.5 pr-3 text-right text-[var(--color-text-primary)]">
                                        {formatSats(row.totalPool)}
                                    </td>
                                    <td className="py-2.5 pr-3 text-right text-[var(--color-text-secondary)]">{row.pct}%</td>
                                    <td className="py-2.5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-16 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-[var(--color-btc-orange)] rounded-full"
                                                    style={{ width: `${row.cumPct}%` }}
                                                />
                                            </div>
                                            <span className="text-[var(--color-text-primary)] text-xs w-10 text-right">{row.cumPct}%</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {concentrationData.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-[var(--color-text-muted)]">
                                        No data
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
