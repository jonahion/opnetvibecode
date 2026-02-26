import { useMemo, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
    RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts';
import { Card } from '../common/Card';
import { AnalyticsData, MarketAnalytics } from '../../hooks/useAnalytics';
import { MarketStatus, MarketOutcome } from '../../types';

interface Props {
    data: AnalyticsData;
    search: string;
}

interface OracleStats {
    address: string;
    marketsServed: number;
    marketsResolved: number;
    marketsPending: number;
    resolvedYes: number;
    resolvedNo: number;
    totalVolume: bigint;
    avgPoolSize: bigint;
    markets: MarketAnalytics[];
}

function truncateAddr(addr: string): string {
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function formatSats(sats: bigint): string {
    const btc = Number(sats) / 100_000_000;
    if (btc >= 0.001) return `${btc.toFixed(4)} BTC`;
    return `${Number(sats).toLocaleString()} sats`;
}

type SortKey = 'marketsServed' | 'marketsResolved' | 'totalVolume';

export function OraclesAnalytics({ data, search }: Props): React.JSX.Element {
    const [sortBy, setSortBy] = useState<SortKey>('marketsServed');
    const [expandedOracle, setExpandedOracle] = useState<string | null>(null);

    const oracleStats = useMemo((): OracleStats[] => {
        const map = new Map<string, OracleStats>();
        for (const m of data.markets) {
            if (!map.has(m.oracle)) {
                map.set(m.oracle, {
                    address: m.oracle,
                    marketsServed: 0,
                    marketsResolved: 0,
                    marketsPending: 0,
                    resolvedYes: 0,
                    resolvedNo: 0,
                    totalVolume: 0n,
                    avgPoolSize: 0n,
                    markets: [],
                });
            }
            const o = map.get(m.oracle)!;
            o.marketsServed++;
            o.totalVolume += m.totalPool;
            o.markets.push(m);
            if (m.status === MarketStatus.RESOLVED) {
                o.marketsResolved++;
                if (m.outcome === MarketOutcome.YES) o.resolvedYes++;
                if (m.outcome === MarketOutcome.NO) o.resolvedNo++;
            } else {
                o.marketsPending++;
            }
        }
        for (const o of map.values()) {
            o.avgPoolSize = o.marketsServed > 0 ? o.totalVolume / BigInt(o.marketsServed) : 0n;
        }
        return Array.from(map.values());
    }, [data.markets]);

    const filtered = useMemo(() => {
        let oracles = oracleStats;
        if (search) {
            const q = search.toLowerCase();
            oracles = oracles.filter((o) => o.address.toLowerCase().includes(q));
        }
        const sortFn = (a: OracleStats, b: OracleStats): number => {
            if (sortBy === 'totalVolume') return Number(b.totalVolume - a.totalVolume);
            return b[sortBy] - a[sortBy];
        };
        return [...oracles].sort(sortFn);
    }, [oracleStats, search, sortBy]);

    const totalOracles = oracleStats.length;
    const totalResolved = oracleStats.reduce((acc, o) => acc + o.marketsResolved, 0);
    const totalPending = oracleStats.reduce((acc, o) => acc + o.marketsPending, 0);

    // Top oracles by markets served
    const topOracles = filtered.slice(0, 10).map((o) => ({
        name: truncateAddr(o.address),
        Served: o.marketsServed,
        Resolved: o.marketsResolved,
    }));

    // Resolution outcome distribution across all oracles
    const outcomeData = useMemo(() => {
        const yes = oracleStats.reduce((acc, o) => acc + o.resolvedYes, 0);
        const no = oracleStats.reduce((acc, o) => acc + o.resolvedNo, 0);
        const pending = oracleStats.reduce((acc, o) => acc + o.marketsPending, 0);
        return [
            { name: 'Resolved YES', value: yes, color: '#22c55e' },
            { name: 'Resolved NO', value: no, color: '#ef4444' },
            { name: 'Pending', value: pending, color: '#f7931a' },
        ].filter((d) => d.value > 0);
    }, [oracleStats]);

    // Radar chart for top oracle (if expanded)
    const radarData = useMemo(() => {
        if (!expandedOracle) return [];
        const o = oracleStats.find((x) => x.address === expandedOracle);
        if (!o) return [];
        const maxServed = Math.max(...oracleStats.map((x) => x.marketsServed), 1);
        const maxResolved = Math.max(...oracleStats.map((x) => x.marketsResolved), 1);
        const maxVolume = Math.max(...oracleStats.map((x) => Number(x.totalVolume)), 1);
        return [
            { metric: 'Markets', value: (o.marketsServed / maxServed) * 100 },
            { metric: 'Resolved', value: (o.marketsResolved / maxResolved) * 100 },
            { metric: 'Volume', value: (Number(o.totalVolume) / maxVolume) * 100 },
            { metric: 'YES Rate', value: o.marketsResolved > 0 ? (o.resolvedYes / o.marketsResolved) * 100 : 0 },
            { metric: 'Completion', value: o.marketsServed > 0 ? (o.marketsResolved / o.marketsServed) * 100 : 0 },
        ];
    }, [expandedOracle, oracleStats]);

    const expandedOracleData = expandedOracle ? oracleStats.find((o) => o.address === expandedOracle) : null;

    return (
        <div className="space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[#555] mb-1">Total Oracles</p>
                    <p className="text-xl font-bold text-[#f7931a]">{totalOracles}</p>
                </div>
                <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[#555] mb-1">Markets Resolved</p>
                    <p className="text-xl font-bold text-green-400">{totalResolved}</p>
                </div>
                <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[#555] mb-1">Pending Resolution</p>
                    <p className="text-xl font-bold text-[#f7931a]">{totalPending}</p>
                </div>
                <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[#555] mb-1">Avg Markets/Oracle</p>
                    <p className="text-xl font-bold text-[#e4e4ec]">
                        {totalOracles > 0 ? (data.markets.length / totalOracles).toFixed(1) : '0'}
                    </p>
                </div>
            </div>

            {/* Charts row */}
            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <h3 className="text-sm font-semibold text-[#e4e4ec] mb-4">Top Oracles</h3>
                    {topOracles.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={topOracles} layout="vertical">
                                <XAxis type="number" tick={{ fill: '#8888a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a3a' }} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={110}
                                    tick={{ fill: '#8888a0', fontSize: 10 }}
                                    axisLine={{ stroke: '#2a2a3a' }}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1a2a', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
                                    itemStyle={{ color: '#e4e4ec' }}
                                />
                                <Bar dataKey="Served" fill="#f7931a" radius={[0, 4, 4, 0]} />
                                <Bar dataKey="Resolved" fill="#22c55e" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-[#555] text-sm text-center py-10">No data</p>
                    )}
                </Card>

                <Card>
                    <h3 className="text-sm font-semibold text-[#e4e4ec] mb-4">Resolution Outcomes</h3>
                    {outcomeData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={outcomeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={85}
                                    paddingAngle={4}
                                    dataKey="value"
                                >
                                    {outcomeData.map((entry, i) => (
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
                        <p className="text-[#555] text-sm text-center py-10">No data</p>
                    )}
                </Card>
            </div>

            {/* Oracle radar detail (if expanded) */}
            {expandedOracleData && radarData.length > 0 && (
                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-[#e4e4ec]">
                            Oracle Profile: <span className="text-[#f7931a] font-mono">{truncateAddr(expandedOracleData.address)}</span>
                        </h3>
                        <button
                            onClick={() => setExpandedOracle(null)}
                            className="text-xs text-[#8888a0] hover:text-[#f7931a] transition-colors cursor-pointer"
                        >
                            Close
                        </button>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                        <ResponsiveContainer width="100%" height={220}>
                            <RadarChart data={radarData}>
                                <PolarGrid stroke="#2a2a3a" />
                                <PolarAngleAxis dataKey="metric" tick={{ fill: '#8888a0', fontSize: 11 }} />
                                <Radar dataKey="value" stroke="#f7931a" fill="#f7931a" fillOpacity={0.2} />
                            </RadarChart>
                        </ResponsiveContainer>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-[#8888a0]">Full Address</span>
                                <span className="text-[#e4e4ec] font-mono text-xs break-all">{expandedOracleData.address}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-[#8888a0]">Markets Served</span>
                                <span className="text-[#e4e4ec] font-bold">{expandedOracleData.marketsServed}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-[#8888a0]">Resolved</span>
                                <span className="text-green-400 font-bold">{expandedOracleData.marketsResolved}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-[#8888a0]">Pending</span>
                                <span className="text-[#f7931a] font-bold">{expandedOracleData.marketsPending}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-[#8888a0]">Total Volume</span>
                                <span className="text-[#f7931a] font-bold">{formatSats(expandedOracleData.totalVolume)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-[#8888a0]">Avg Pool Size</span>
                                <span className="text-[#e4e4ec]">{formatSats(expandedOracleData.avgPoolSize)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-[#8888a0]">YES / NO Ratio</span>
                                <span className="text-[#e4e4ec]">
                                    {expandedOracleData.resolvedYes}Y / {expandedOracleData.resolvedNo}N
                                </span>
                            </div>
                        </div>
                    </div>
                    {/* Oracle's markets */}
                    <div className="mt-4 border-t border-[#2a2a3a] pt-4">
                        <h4 className="text-xs uppercase tracking-wider text-[#555] mb-3">Markets</h4>
                        <div className="space-y-1">
                            {expandedOracleData.markets.map((m) => (
                                <div key={m.id.toString()} className="flex justify-between text-xs text-[#8888a0]">
                                    <span>
                                        <span className="text-[#f7931a]">#{m.id.toString()}</span>{' '}
                                        {m.question}
                                    </span>
                                    <span className="shrink-0 ml-2">
                                        <span className={`font-bold ${
                                            m.status === MarketStatus.RESOLVED ? 'text-[#8888a0]' : 'text-green-400'
                                        }`}>
                                            {m.status === MarketStatus.RESOLVED
                                                ? m.outcome === MarketOutcome.YES ? 'YES' : 'NO'
                                                : 'LIVE'}
                                        </span>
                                        {' '}{formatSats(m.totalPool)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>
            )}

            {/* Oracle table */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[#e4e4ec]">
                        All Oracles ({filtered.length})
                    </h3>
                    <div className="flex gap-1">
                        {(['marketsServed', 'marketsResolved', 'totalVolume'] as SortKey[]).map((key) => (
                            <button
                                key={key}
                                onClick={() => setSortBy(key)}
                                className={`px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                                    sortBy === key
                                        ? 'bg-[#f7931a]/20 text-[#f7931a]'
                                        : 'text-[#555] hover:text-[#8888a0]'
                                }`}
                            >
                                {key === 'marketsServed' ? 'Served' : key === 'marketsResolved' ? 'Resolved' : 'Volume'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[#555] text-xs uppercase tracking-wider border-b border-[#2a2a3a]">
                                <th className="text-left py-2 pr-3">Oracle Address</th>
                                <th className="text-right py-2 pr-3">Served</th>
                                <th className="text-right py-2 pr-3">Resolved</th>
                                <th className="text-right py-2 pr-3">Pending</th>
                                <th className="text-right py-2 pr-3">Volume</th>
                                <th className="text-right py-2">Completion</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((o) => (
                                <tr
                                    key={o.address}
                                    onClick={() => setExpandedOracle(expandedOracle === o.address ? null : o.address)}
                                    className={`border-b border-[#2a2a3a]/50 hover:bg-[#1a1a24] cursor-pointer transition-colors ${
                                        expandedOracle === o.address ? 'bg-[#1a1a24]' : ''
                                    }`}
                                >
                                    <td className="py-2.5 pr-3">
                                        <span className="text-[#e4e4ec] font-mono text-xs">
                                            {truncateAddr(o.address)}
                                        </span>
                                    </td>
                                    <td className="py-2.5 pr-3 text-right text-[#f7931a]">{o.marketsServed}</td>
                                    <td className="py-2.5 pr-3 text-right text-green-400">{o.marketsResolved}</td>
                                    <td className="py-2.5 pr-3 text-right text-[#f7931a]">{o.marketsPending}</td>
                                    <td className="py-2.5 pr-3 text-right text-[#e4e4ec]">{formatSats(o.totalVolume)}</td>
                                    <td className="py-2.5 text-right">
                                        <span className={`font-medium ${
                                            o.marketsServed > 0 && o.marketsResolved === o.marketsServed
                                                ? 'text-green-400'
                                                : 'text-[#8888a0]'
                                        }`}>
                                            {o.marketsServed > 0
                                                ? `${((o.marketsResolved / o.marketsServed) * 100).toFixed(0)}%`
                                                : '—'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-[#555]">
                                        No oracles match your search
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
