import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Card } from '../common/Card';
import { AnalyticsData, MarketAnalytics } from '../../hooks/useAnalytics';
import { MarketStatus } from '../../types';
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

function StatCard({ label, value, color }: { label: string; value: string; color?: string }): React.JSX.Element {
    return (
        <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-[#555] mb-1">{label}</p>
            <p className={`text-xl font-bold ${color || 'text-[#e4e4ec]'}`}>{value}</p>
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any): React.JSX.Element | null {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[#1a1a2a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-xs">
            <p className="text-[#e4e4ec] font-medium mb-1">Market {label}</p>
            {payload.map((p: { name: string; value: number; color: string }, i: number) => (
                <p key={i} style={{ color: p.color }}>
                    {p.name}: {p.value.toLocaleString()} sats
                </p>
            ))}
        </div>
    );
}

export function MarketsAnalytics({ data, search, blockRange, dateRange }: Props): React.JSX.Element {
    const navigate = useNavigate();
    const { overview } = data;

    const filtered = useMemo((): MarketAnalytics[] => {
        return filterMarkets({ markets: data.markets, search, blockRange, dateRange });
    }, [data.markets, search, blockRange, dateRange]);

    const volumeData = filtered.map((m) => ({
        name: `#${m.id}`,
        YES: Number(m.yesPool),
        NO: Number(m.noPool),
    }));

    return (
        <div className="space-y-6">
            {/* Overview stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Total Markets" value={String(overview.totalMarkets)} color="text-[#f7931a]" />
                <StatCard label="Open / Live" value={String(overview.openMarkets)} color="text-green-400" />
                <StatCard label="Resolved" value={String(overview.resolvedMarkets)} color="text-[#8888a0]" />
                <StatCard label="Total Volume" value={formatSats(overview.totalVolume)} color="text-[#f7931a]" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Avg Pool Size" value={formatSats(overview.avgPoolSize)} />
                <StatCard label="Largest Pool" value={formatSats(overview.largestPool)} />
                <StatCard label="YES Volume" value={formatSats(overview.totalYesVolume)} color="text-green-400" />
                <StatCard label="NO Volume" value={formatSats(overview.totalNoVolume)} color="text-red-400" />
            </div>

            {/* Charts row */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Volume by market */}
                <Card>
                    <h3 className="text-sm font-semibold text-[#e4e4ec] mb-4">Volume by Market</h3>
                    {volumeData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={volumeData}>
                                <XAxis dataKey="name" tick={{ fill: '#8888a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a3a' }} />
                                <YAxis tick={{ fill: '#8888a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a3a' }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="YES" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="NO" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-[#555] text-sm text-center py-10">No data to display</p>
                    )}
                </Card>

                {/* Status distribution */}
                <Card>
                    <h3 className="text-sm font-semibold text-[#e4e4ec] mb-4">Market Status</h3>
                    {data.statusDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={data.statusDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={4}
                                    dataKey="value"
                                >
                                    {data.statusDistribution.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Legend
                                    formatter={(value: string) => <span className="text-[#8888a0] text-xs">{value}</span>}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1a2a', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
                                    itemStyle={{ color: '#e4e4ec' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-[#555] text-sm text-center py-10">No data to display</p>
                    )}
                </Card>
            </div>

            {/* Market table */}
            <Card>
                <h3 className="text-sm font-semibold text-[#e4e4ec] mb-4">
                    All Markets ({filtered.length})
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[#555] text-xs uppercase tracking-wider border-b border-[#2a2a3a]">
                                <th className="text-left py-2 pr-3">ID</th>
                                <th className="text-left py-2 pr-3">Question</th>
                                <th className="text-left py-2 pr-3">Status</th>
                                <th className="text-right py-2 pr-3">YES</th>
                                <th className="text-right py-2 pr-3">NO</th>
                                <th className="text-right py-2 pr-3">Total</th>
                                <th className="text-right py-2">End Block</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((m) => (
                                <tr
                                    key={m.id.toString()}
                                    onClick={() => navigate(`/market/${m.id}`)}
                                    className="border-b border-[#2a2a3a]/50 hover:bg-[#1a1a24] cursor-pointer transition-colors"
                                >
                                    <td className="py-2.5 pr-3 text-[#f7931a] font-medium whitespace-nowrap">#{m.id.toString()}</td>
                                    <td className="py-2.5 pr-3 text-[#e4e4ec] max-w-[250px] truncate" title={m.question}>{m.question}</td>
                                    <td className="py-2.5 pr-3">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                            m.status === MarketStatus.OPEN
                                                ? 'text-green-400 bg-green-400/10'
                                                : 'text-[#8888a0] bg-[#8888a0]/10'
                                        }`}>
                                            {m.status === MarketStatus.OPEN ? 'LIVE' : 'RESOLVED'}
                                        </span>
                                    </td>
                                    <td className="py-2.5 pr-3 text-right text-green-400">{formatSats(m.yesPool)}</td>
                                    <td className="py-2.5 pr-3 text-right text-red-400">{formatSats(m.noPool)}</td>
                                    <td className="py-2.5 pr-3 text-right text-[#f7931a] font-medium">{formatSats(m.totalPool)}</td>
                                    <td className="py-2.5 text-right text-[#8888a0]">#{m.endBlock.toLocaleString()}</td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-[#555]">
                                        No markets match your filters
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
