import { useMemo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
    BarChart, Bar,
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

function formatSats(sats: bigint): string {
    const btc = Number(sats) / 100_000_000;
    if (btc >= 0.001) return `${btc.toFixed(4)} BTC`;
    return `${Number(sats).toLocaleString()} sats`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any): React.JSX.Element | null {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[#1a1a2a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-xs">
            <p className="text-[#e4e4ec] font-medium mb-1">{label}</p>
            {payload.map((p: { name: string; value: number; color: string }, i: number) => (
                <p key={i} style={{ color: p.color }}>
                    {p.name}: {p.value.toLocaleString()} sats
                </p>
            ))}
        </div>
    );
}

export function OverviewAnalytics({ data, search, blockRange, dateRange }: Props): React.JSX.Element {
    const filtered = useMemo((): MarketAnalytics[] => {
        return filterMarkets({ markets: data.markets, search, blockRange, dateRange });
    }, [data.markets, search, blockRange, dateRange]);

    const tvl = useMemo(() => filtered.reduce((acc, m) => acc + m.totalPool, 0n), [filtered]);
    const tvlOpen = useMemo(
        () => filtered.filter((m) => m.status === 1).reduce((acc, m) => acc + m.totalPool, 0n),
        [filtered],
    );
    const tvlResolved = useMemo(
        () => filtered.filter((m) => m.status === 2).reduce((acc, m) => acc + m.totalPool, 0n),
        [filtered],
    );

    // TVL over markets (cumulative)
    const tvlOverTime = useMemo(() => {
        let cumulative = 0;
        return filtered.map((m) => {
            cumulative += Number(m.totalPool);
            return {
                name: `#${m.id}`,
                TVL: cumulative,
            };
        });
    }, [filtered]);

    // TVL breakdown: YES vs NO locked
    const tvlBreakdown = useMemo(() => {
        let cumYes = 0;
        let cumNo = 0;
        return filtered.map((m) => {
            cumYes += Number(m.yesPool);
            cumNo += Number(m.noPool);
            return {
                name: `#${m.id}`,
                'YES Locked': cumYes,
                'NO Locked': cumNo,
            };
        });
    }, [filtered]);

    // Per-market TVL bar
    const perMarketTvl = filtered.map((m) => ({
        name: `#${m.id}`,
        YES: Number(m.yesPool),
        NO: Number(m.noPool),
    }));

    const uniqueOracles = new Set(filtered.map((m) => m.oracle)).size;
    const uniqueCreators = new Set(filtered.map((m) => m.creator)).size;

    return (
        <div className="space-y-6">
            {/* Hero TVL */}
            <div className="bg-gradient-to-br from-[#f7931a]/10 to-[#111118] border border-[#f7931a]/30 rounded-2xl p-6">
                <p className="text-xs uppercase tracking-wider text-[#f7931a] mb-2">Total Value Locked</p>
                <p className="text-4xl font-bold text-[#f7931a]">{formatSats(tvl)}</p>
                <p className="text-sm text-[#8888a0] mt-2">
                    Across {filtered.length} market{filtered.length !== 1 ? 's' : ''}
                </p>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[#555] mb-1">Markets</p>
                    <p className="text-xl font-bold text-[#f7931a]">{filtered.length}</p>
                </div>
                <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[#555] mb-1">TVL in Open</p>
                    <p className="text-xl font-bold text-green-400">{formatSats(tvlOpen)}</p>
                </div>
                <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[#555] mb-1">TVL Resolved</p>
                    <p className="text-xl font-bold text-[#8888a0]">{formatSats(tvlResolved)}</p>
                </div>
                <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[#555] mb-1">Oracles</p>
                    <p className="text-xl font-bold text-[#e4e4ec]">{uniqueOracles}</p>
                </div>
                <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[#555] mb-1">Creators</p>
                    <p className="text-xl font-bold text-[#e4e4ec]">{uniqueCreators}</p>
                </div>
            </div>

            {/* TVL over time */}
            <Card>
                <h3 className="text-sm font-semibold text-[#e4e4ec] mb-4">TVL Growth</h3>
                {tvlOverTime.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={tvlOverTime}>
                            <defs>
                                <linearGradient id="gradTvl" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f7931a" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#f7931a" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="name" tick={{ fill: '#8888a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a3a' }} />
                            <YAxis tick={{ fill: '#8888a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a3a' }} />
                            <Tooltip content={<ChartTooltip />} />
                            <Area type="monotone" dataKey="TVL" stroke="#f7931a" fill="url(#gradTvl)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-[#555] text-sm text-center py-10">No data to display</p>
                )}
            </Card>

            {/* TVL breakdown + per-market */}
            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <h3 className="text-sm font-semibold text-[#e4e4ec] mb-4">Cumulative YES vs NO Locked</h3>
                    {tvlBreakdown.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={tvlBreakdown}>
                                <defs>
                                    <linearGradient id="gradYesLock" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradNoLock" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" tick={{ fill: '#8888a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a3a' }} />
                                <YAxis tick={{ fill: '#8888a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a3a' }} />
                                <Tooltip content={<ChartTooltip />} />
                                <Area type="monotone" dataKey="YES Locked" stroke="#22c55e" fill="url(#gradYesLock)" strokeWidth={2} />
                                <Area type="monotone" dataKey="NO Locked" stroke="#ef4444" fill="url(#gradNoLock)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-[#555] text-sm text-center py-10">No data</p>
                    )}
                </Card>

                <Card>
                    <h3 className="text-sm font-semibold text-[#e4e4ec] mb-4">TVL per Market</h3>
                    {perMarketTvl.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={perMarketTvl}>
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
            </div>
        </div>
    );
}
