import { useMemo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
    BarChart, Bar,
    LineChart, Line,
} from 'recharts';
import { Card } from '../common/Card';
import { AnalyticsData, MarketAnalytics } from '../../hooks/useAnalytics';
import { filterMarkets } from '../../utils/filterMarkets';

interface Props {
    data: AnalyticsData;
    search: string;
    blockRange: { from: string; to: string };
    dateRange: { from: string; to: string };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any): React.JSX.Element | null {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[var(--color-bg-card-hover)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs">
            <p className="text-[var(--color-text-primary)] font-medium mb-1">{label}</p>
            {payload.map((p: { name: string; value: number; color: string }, i: number) => (
                <p key={i} style={{ color: p.color }}>
                    {p.name}: {p.value.toLocaleString()} sats
                </p>
            ))}
        </div>
    );
}

export function TrendsAnalytics({ data, search, blockRange, dateRange }: Props): React.JSX.Element {
    const filtered = useMemo((): MarketAnalytics[] => {
        return filterMarkets({ markets: data.markets, search, blockRange, dateRange });
    }, [data.markets, search, blockRange, dateRange]);

    // Cumulative volume over markets
    const cumulativeVolume = useMemo(() => {
        let cumYes = 0;
        let cumNo = 0;
        return filtered.map((m) => {
            cumYes += Number(m.yesPool);
            cumNo += Number(m.noPool);
            return {
                name: `#${m.id}`,
                'Cumulative YES': cumYes,
                'Cumulative NO': cumNo,
                'Cumulative Total': cumYes + cumNo,
            };
        });
    }, [filtered]);

    // YES vs NO ratio per market
    const ratioData = filtered.map((m) => ({
        name: `#${m.id}`,
        'YES %': m.yesPercent,
        'NO %': m.noPercent,
    }));

    // Pool size per market (bar)
    const poolSizes = filtered.map((m) => ({
        name: `#${m.id}`,
        Pool: Number(m.totalPool),
    }));

    // Market duration (endBlock spread)
    const durationData = filtered.map((m) => ({
        name: `#${m.id}`,
        'End Block': Number(m.endBlock),
    }));

    const totalFiltered = filtered.reduce((acc, m) => acc + Number(m.totalPool), 0);
    const avgYesBias = filtered.length > 0
        ? filtered.reduce((acc, m) => acc + m.yesPercent, 0) / filtered.length
        : 50;

    return (
        <div className="space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Filtered Markets</p>
                    <p className="text-xl font-bold text-[var(--color-btc-orange)]">{filtered.length}</p>
                </div>
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Filtered Volume</p>
                    <p className="text-xl font-bold text-[var(--color-text-primary)]">{totalFiltered.toLocaleString()} sats</p>
                </div>
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Avg YES Bias</p>
                    <p className={`text-xl font-bold ${avgYesBias >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                        {avgYesBias.toFixed(1)}%
                    </p>
                </div>
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Outcome Ratio</p>
                    <p className="text-xl font-bold text-[var(--color-text-primary)]">
                        {data.overview.resolvedYes}Y / {data.overview.resolvedNo}N
                    </p>
                </div>
            </div>

            {/* Cumulative volume area chart */}
            <Card>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Cumulative Volume</h3>
                {cumulativeVolume.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={cumulativeVolume}>
                            <defs>
                                <linearGradient id="gradYes" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradNo" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="name" tick={{ fill: '#8888a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a3a' }} />
                            <YAxis tick={{ fill: '#8888a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a3a' }} />
                            <Tooltip content={<ChartTooltip />} />
                            <Area type="monotone" dataKey="Cumulative YES" stroke="#22c55e" fill="url(#gradYes)" strokeWidth={2} />
                            <Area type="monotone" dataKey="Cumulative NO" stroke="#ef4444" fill="url(#gradNo)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-[var(--color-text-muted)] text-sm text-center py-10">No data to display</p>
                )}
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
                {/* YES/NO ratio line chart */}
                <Card>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">YES/NO Ratio per Market</h3>
                    {ratioData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={ratioData}>
                                <XAxis dataKey="name" tick={{ fill: '#8888a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a3a' }} />
                                <YAxis domain={[0, 100]} tick={{ fill: '#8888a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a3a' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1a2a', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
                                    itemStyle={{ color: '#e4e4ec' }}
                                />
                                <Line type="monotone" dataKey="YES %" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 4 }} />
                                <Line type="monotone" dataKey="NO %" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-[var(--color-text-muted)] text-sm text-center py-10">No data</p>
                    )}
                </Card>

                {/* Pool sizes bar chart */}
                <Card>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Pool Size per Market</h3>
                    {poolSizes.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={poolSizes}>
                                <XAxis dataKey="name" tick={{ fill: '#8888a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a3a' }} />
                                <YAxis tick={{ fill: '#8888a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a3a' }} />
                                <Tooltip content={<ChartTooltip />} />
                                <Bar dataKey="Pool" fill="#f7931a" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-[var(--color-text-muted)] text-sm text-center py-10">No data</p>
                    )}
                </Card>
            </div>

            {/* Outcome distribution pie + end block timeline */}
            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Outcome Distribution</h3>
                    {data.outcomeDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie
                                    data={data.outcomeDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={4}
                                    dataKey="value"
                                >
                                    {data.outcomeDistribution.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Legend
                                    formatter={(value: string) => <span className="text-[var(--color-text-secondary)] text-xs">{value}</span>}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1a2a', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
                                    itemStyle={{ color: '#e4e4ec' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-[var(--color-text-muted)] text-sm text-center py-10">No data</p>
                    )}
                </Card>

                <Card>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Market End Blocks</h3>
                    {durationData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={durationData}>
                                <XAxis dataKey="name" tick={{ fill: '#8888a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a3a' }} />
                                <YAxis tick={{ fill: '#8888a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a3a' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1a2a', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
                                    itemStyle={{ color: '#e4e4ec' }}
                                />
                                <Bar dataKey="End Block" fill="#8888a0" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-[var(--color-text-muted)] text-sm text-center py-10">No data</p>
                    )}
                </Card>
            </div>
        </div>
    );
}
