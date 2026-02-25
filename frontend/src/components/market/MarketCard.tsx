import { useNavigate } from 'react-router-dom';
import { Card } from '../common/Card';
import { MarketData, MarketStatus } from '../../types';

interface MarketCardProps {
    market: MarketData;
}

function formatSats(sats: bigint): string {
    const btc = Number(sats) / 100_000_000;
    if (btc >= 0.001) return `${btc.toFixed(4)} BTC`;
    return `${sats.toLocaleString()} sats`;
}

function getStatusLabel(status: MarketStatus): { text: string; color: string } {
    switch (status) {
        case MarketStatus.OPEN:
            return { text: 'LIVE', color: 'text-green-400 bg-green-400/10' };
        case MarketStatus.RESOLVED:
            return { text: 'RESOLVED', color: 'text-[#8888a0] bg-[#8888a0]/10' };
        default:
            return { text: 'UNKNOWN', color: 'text-[#8888a0] bg-[#8888a0]/10' };
    }
}

export function MarketCard({ market }: MarketCardProps): React.JSX.Element {
    const navigate = useNavigate();
    const totalPool = market.yesPool + market.noPool;
    const yesPercent = totalPool > 0n
        ? Number((market.yesPool * 10000n) / totalPool) / 100
        : 50;
    const noPercent = totalPool > 0n ? 100 - yesPercent : 50;
    const status = getStatusLabel(market.status);

    return (
        <Card
            hoverable
            onClick={() => navigate(`/market/${market.id}`)}
            className="group"
        >
            <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#e4e4ec] group-hover:text-[#f7931a] transition-colors leading-snug flex-1 mr-3">
                    {market.question}
                </h3>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${status.color}`}>
                    {status.text}
                </span>
            </div>

            <div className="mb-4">
                <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-green-400 font-medium">YES {yesPercent.toFixed(1)}%</span>
                    <span className="text-red-400 font-medium">NO {noPercent.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2.5 bg-red-500/30 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-green-500 rounded-full transition-all duration-500"
                        style={{ width: `${yesPercent}%` }}
                    />
                </div>
            </div>

            <div className="flex items-center justify-between text-sm text-[#8888a0]">
                <span>Pool: {formatSats(totalPool)}</span>
                <span>Ends block #{market.endBlock.toLocaleString()}</span>
            </div>
        </Card>
    );
}
