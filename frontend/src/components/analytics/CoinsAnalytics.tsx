import { useMemo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
    BarChart, Bar,
    Treemap,
} from 'recharts';
import { Card } from '../common/Card';
import { AnalyticsData, MarketAnalytics } from '../../hooks/useAnalytics';
import { MarketStatus } from '../../types';

interface Props {
    data: AnalyticsData;
    search: string;
    blockRange: { from: string; to: string };
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
        <div className="bg-[#1a1a2a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-xs">
            <p className="text-[#e4e4ec] font-medium mb-1">{label}</p>
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

export function CoinsAnalytics({ data, search, blockRange }: Props): React.JSX.Element {
    const filtered = useMemo((): MarketAnalytics[] => {
        let markets = data.markets;
        if (search) {
            const q = search.toLowerCase();
            markets = markets.filter(
                (m) => m.question.toLowerCase().includes(q) || `#${m.id}`.includes(q),
            );
        }
        if (blockRange.from) {
            markets = markets.filter((m) => m.endBlock >= BigInt(blockRange.from));
        }
        if (blockRange.to) {
            markets = markets.filter((m) => m.endBlock <= BigInt(blockRange.to));
        }
        return markets;
    }, [data.markets, search, blockRange]);

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
                name: `#${m.id}`,
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
        name: `#${m.id}`,
        YES: Number(m.yesPool),
        NO: Number(m.noPool),
    }));

    // Treemap of pool sizes
    const treemapData = filtered
        .filter((m) => Number(m.totalPool) > 0)
        .map((m) => ({
            name: `#${m.id}`,
            size: Number(m.totalPool),
        }));

    // Sats concentration — top markets by %
    const concentrationData = useMemo(() => {
        if (totalSats === 0) return [];
        const sorted = [...filtered].sort((a, b) => Number(b.totalPool) - Number(a.totalPool));
        let cumPercent = 0;
        return sorted.map((m) => {
            const pct = (Number(m.totalPool) / totalSats) * 100;
            cumPercent += pct;
            return {
                name: `#${m.id}`,
                '% of Total': Math.round(pct * 10) / 10,
                'Cumulative %': Math.round(cumPercent * 10) / 10,
            };
        });
    }, [filtered, totalSats]);

    return (
        <div className="space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[#555] mb-1">Total Sats</p>
                    <p className="text-xl font-bold text-[#f7931a]">{formatSats(totalSats)}</p>
                </div>
                <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[#555] mb-1">YES Pool</p>
                    <p className="text-xl font-bold text-green-400">{formatSats(totalYes)}</p>
                </div>
                <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[#555] mb-1">NO Pool</p>
                    <p className="text-xl font-bold text-red-400">{formatSats(totalNo)}</p>
                </div>
                <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[#555] mb-1">Locked (Open)</p>
                    <p className="text-xl font-bold text-[#f7931a]">{formatSats(openSats)}</p>
                </div>
                <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[#555] mb-1">Settled</p>
                    <p className="text-xl font-bold text-[#8888a0]">{formatSats(resolvedSats)}</p>
                </div>
                <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[#555] mb-1">Avg Pool</p>
                    <p className="text-xl font-bold text-[#e4e4ec]">{formatSats(avgBetSize)}</p>
                </div>
            </div>

            {/* Sats flow chart */}
            <Card>
                <h3 className="text-sm font-semibold text-[#e4e4ec] mb-4">Cumulative Sats Locked</h3>
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
                    <p className="text-[#555] text-sm text-center py-10">No data</p>
                )}
            </Card>

            {/* Pies row */}
            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <h3 className="text-sm font-semibold text-[#e4e4ec] mb-4">YES / NO Allocation</h3>
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
                                    formatter={(value: string) => <span className="text-[#8888a0] text-xs">{value}</span>}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1a2a', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
                                    formatter={(value: number | undefined) => formatSats(value ?? 0)}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-[#555] text-sm text-center py-10">No data</p>
                    )}
                </Card>

                <Card>
                    <h3 className="text-sm font-semibold text-[#e4e4ec] mb-4">Locked vs Settled</h3>
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
                                    formatter={(value: string) => <span className="text-[#8888a0] text-xs">{value}</span>}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1a2a', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
                                    formatter={(value: number | undefined) => formatSats(value ?? 0)}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-[#555] text-sm text-center py-10">No data</p>
                    )}
                </Card>
            </div>

            {/* Per-market bar + treemap */}
            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <h3 className="text-sm font-semibold text-[#e4e4ec] mb-4">Sats per Market</h3>
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
                        <p className="text-[#555] text-sm text-center py-10">No data</p>
                    )}
                </Card>

                <Card>
                    <h3 className="text-sm font-semibold text-[#e4e4ec] mb-4">Pool Size Map</h3>
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
                        <p className="text-[#555] text-sm text-center py-10">No data</p>
                    )}
                </Card>
            </div>

            {/* Concentration table */}
            <Card>
                <h3 className="text-sm font-semibold text-[#e4e4ec] mb-4">
                    Sats Concentration
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[#555] text-xs uppercase tracking-wider border-b border-[#2a2a3a]">
                                <th className="text-left py-2 pr-3">Market</th>
                                <th className="text-right py-2 pr-3">Pool</th>
                                <th className="text-right py-2 pr-3">% of Total</th>
                                <th className="text-right py-2">Cumulative %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {concentrationData.map((row) => (
                                <tr key={row.name} className="border-b border-[#2a2a3a]/50">
                                    <td className="py-2.5 pr-3 text-[#f7931a] font-medium">{row.name}</td>
                                    <td className="py-2.5 pr-3 text-right text-[#e4e4ec]">
                                        {formatSats(filtered.find((m) => `#${m.id}` === row.name)?.totalPool ?? 0n)}
                                    </td>
                                    <td className="py-2.5 pr-3 text-right text-[#8888a0]">{row['% of Total']}%</td>
                                    <td className="py-2.5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-16 h-1.5 bg-[#2a2a3a] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-[#f7931a] rounded-full"
                                                    style={{ width: `${row['Cumulative %']}%` }}
                                                />
                                            </div>
                                            <span className="text-[#e4e4ec] text-xs w-10 text-right">{row['Cumulative %']}%</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {concentrationData.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-[#555]">
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
