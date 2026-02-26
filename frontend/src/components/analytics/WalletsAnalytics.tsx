import { useMemo, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Card } from '../common/Card';
import { AnalyticsData, WalletStats } from '../../hooks/useAnalytics';

interface Props {
    data: AnalyticsData;
    search: string;
}

type SortKey = 'totalActivity' | 'marketsCreated' | 'marketsAsOracle';

function truncateAddr(addr: string): string {
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

export function WalletsAnalytics({ data, search }: Props): React.JSX.Element {
    const [sortBy, setSortBy] = useState<SortKey>('totalActivity');
    const [expandedWallet, setExpandedWallet] = useState<string | null>(null);

    const filtered = useMemo((): WalletStats[] => {
        let wallets = data.wallets;
        if (search) {
            const q = search.toLowerCase();
            wallets = wallets.filter((w) => w.address.toLowerCase().includes(q));
        }
        return [...wallets].sort((a, b) => b[sortBy] - a[sortBy]);
    }, [data.wallets, search, sortBy]);

    const topCreators = filtered.slice(0, 10).map((w) => ({
        name: truncateAddr(w.address),
        Markets: w.marketsCreated,
    }));

    const roleDistribution = useMemo(() => {
        const creatorsOnly = data.wallets.filter((w) => w.marketsCreated > 0 && w.marketsAsOracle === 0).length;
        const oraclesOnly = data.wallets.filter((w) => w.marketsAsOracle > 0 && w.marketsCreated === 0).length;
        const both = data.wallets.filter((w) => w.marketsCreated > 0 && w.marketsAsOracle > 0).length;
        return [
            { name: 'Creator Only', value: creatorsOnly, color: '#f7931a' },
            { name: 'Oracle Only', value: oraclesOnly, color: '#8888a0' },
            { name: 'Both', value: both, color: '#22c55e' },
        ].filter((d) => d.value > 0);
    }, [data.wallets]);

    // Markets created by each wallet for the expanded detail
    const walletMarkets = useMemo(() => {
        if (!expandedWallet) return [];
        return data.markets.filter(
            (m) => m.creator === expandedWallet || m.oracle === expandedWallet,
        );
    }, [expandedWallet, data.markets]);

    return (
        <div className="space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[#555] mb-1">Unique Wallets</p>
                    <p className="text-xl font-bold text-[#f7931a]">{data.wallets.length}</p>
                </div>
                <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[#555] mb-1">Creators</p>
                    <p className="text-xl font-bold text-[#e4e4ec]">
                        {data.wallets.filter((w) => w.marketsCreated > 0).length}
                    </p>
                </div>
                <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-[#555] mb-1">Oracles</p>
                    <p className="text-xl font-bold text-[#e4e4ec]">
                        {data.wallets.filter((w) => w.marketsAsOracle > 0).length}
                    </p>
                </div>
            </div>

            {/* Charts row */}
            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <h3 className="text-sm font-semibold text-[#e4e4ec] mb-4">Top Market Creators</h3>
                    {topCreators.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={topCreators} layout="vertical">
                                <XAxis type="number" tick={{ fill: '#8888a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a3a' }} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={100}
                                    tick={{ fill: '#8888a0', fontSize: 10 }}
                                    axisLine={{ stroke: '#2a2a3a' }}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1a2a', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
                                    itemStyle={{ color: '#e4e4ec' }}
                                />
                                <Bar dataKey="Markets" fill="#f7931a" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-[#555] text-sm text-center py-10">No data</p>
                    )}
                </Card>

                <Card>
                    <h3 className="text-sm font-semibold text-[#e4e4ec] mb-4">Wallet Roles</h3>
                    {roleDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={roleDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={85}
                                    paddingAngle={4}
                                    dataKey="value"
                                >
                                    {roleDistribution.map((entry, i) => (
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

            {/* Wallet table */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[#e4e4ec]">
                        All Wallets ({filtered.length})
                    </h3>
                    <div className="flex gap-1">
                        {(['totalActivity', 'marketsCreated', 'marketsAsOracle'] as SortKey[]).map((key) => (
                            <button
                                key={key}
                                onClick={() => setSortBy(key)}
                                className={`px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                                    sortBy === key
                                        ? 'bg-[#f7931a]/20 text-[#f7931a]'
                                        : 'text-[#555] hover:text-[#8888a0]'
                                }`}
                            >
                                {key === 'totalActivity' ? 'Activity' : key === 'marketsCreated' ? 'Created' : 'Oracle'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[#555] text-xs uppercase tracking-wider border-b border-[#2a2a3a]">
                                <th className="text-left py-2 pr-3">Address</th>
                                <th className="text-right py-2 pr-3">Created</th>
                                <th className="text-right py-2 pr-3">Oracle</th>
                                <th className="text-right py-2">Activity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((w) => (
                                <>
                                    <tr
                                        key={w.address}
                                        onClick={() => setExpandedWallet(expandedWallet === w.address ? null : w.address)}
                                        className="border-b border-[#2a2a3a]/50 hover:bg-[#1a1a24] cursor-pointer transition-colors"
                                    >
                                        <td className="py-2.5 pr-3">
                                            <span className="text-[#e4e4ec] font-mono text-xs">
                                                {truncateAddr(w.address)}
                                            </span>
                                        </td>
                                        <td className="py-2.5 pr-3 text-right text-[#f7931a]">{w.marketsCreated}</td>
                                        <td className="py-2.5 pr-3 text-right text-[#8888a0]">{w.marketsAsOracle}</td>
                                        <td className="py-2.5 text-right text-[#e4e4ec] font-medium">{w.totalActivity}</td>
                                    </tr>
                                    {expandedWallet === w.address && (
                                        <tr key={`${w.address}-detail`}>
                                            <td colSpan={4} className="py-3 px-4 bg-[#0a0a0f]">
                                                <p className="text-xs text-[#555] mb-2 font-mono break-all">{w.address}</p>
                                                {walletMarkets.length > 0 ? (
                                                    <div className="space-y-1">
                                                        {walletMarkets.map((m) => (
                                                            <div key={m.id.toString()} className="flex justify-between text-xs text-[#8888a0]">
                                                                <span>
                                                                    <span className="text-[#f7931a]">#{m.id.toString()}</span>{' '}
                                                                    {m.question}
                                                                </span>
                                                                <span className="shrink-0 ml-2">
                                                                    {m.creator === w.address ? 'Creator' : ''}
                                                                    {m.creator === w.address && m.oracle === w.address ? ' + ' : ''}
                                                                    {m.oracle === w.address ? 'Oracle' : ''}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-[#555]">No market involvement found</p>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-[#555]">
                                        No wallets match your search
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
