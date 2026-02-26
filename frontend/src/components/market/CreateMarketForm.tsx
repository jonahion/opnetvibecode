import { useState, useRef, useEffect, FormEvent } from 'react';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { usePredictionMarket } from '../../hooks/usePredictionMarket';

const POPULAR_COINS = [
    'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'DOT', 'AVAX', 'MATIC', 'LINK',
    'UNI', 'ATOM', 'LTC', 'BCH', 'NEAR', 'APT', 'ARB', 'OP', 'SUI', 'SEI',
    'TIA', 'INJ', 'FET', 'RNDR', 'STX', 'RUNE', 'PEPE', 'WIF', 'BONK',
];

const BLOCK_TIME_MINUTES = 10;

function deadlineToBlocks(deadline: string): bigint {
    const target = new Date(deadline).getTime();
    const now = Date.now();
    const diffMs = target - now;
    if (diffMs <= 0) return 1n;
    const blocks = Math.ceil(diffMs / (BLOCK_TIME_MINUTES * 60 * 1000));
    return BigInt(blocks);
}

function formatPrice(value: string): string {
    const num = Number(value);
    if (isNaN(num) || num <= 0) return '';
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function CoinSelector({ value, onChange }: { value: string; onChange: (v: string) => void }): React.JSX.Element {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    const filtered = POPULAR_COINS.filter(
        (c) => !search || c.toLowerCase().includes(search.toLowerCase()),
    ).slice(0, 10);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <div
                onClick={() => setOpen(!open)}
                className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl px-4 py-3 text-[#e4e4ec] cursor-pointer flex items-center justify-between hover:border-[#f7931a]/50 transition-colors"
            >
                {value ? (
                    <span className="font-semibold text-[#f7931a]">{value}</span>
                ) : (
                    <span className="text-[#555]">Select a coin...</span>
                )}
                <svg className={`w-4 h-4 text-[#555] transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>
            {open && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a2a] border border-[#2a2a3a] rounded-xl overflow-hidden z-10 shadow-lg max-h-64 flex flex-col">
                    <div className="p-2 border-b border-[#2a2a3a]">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search coins..."
                            className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#e4e4ec] placeholder-[#555] focus:border-[#f7931a] focus:outline-none"
                            autoFocus
                        />
                    </div>
                    <div className="overflow-y-auto">
                        {filtered.map((coin) => (
                            <button
                                key={coin}
                                onClick={() => { onChange(coin); setSearch(''); setOpen(false); }}
                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                                    value === coin
                                        ? 'bg-[#f7931a]/20 text-[#f7931a] font-semibold'
                                        : 'text-[#e4e4ec] hover:bg-[#f7931a]/10 hover:text-[#f7931a]'
                                }`}
                            >
                                {coin}
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <p className="px-4 py-3 text-sm text-[#555]">No coins match &quot;{search}&quot;</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export function CreateMarketForm(): React.JSX.Element {
    const { address } = useWalletConnect();
    const { createMarket, loading, error } = usePredictionMarket();
    const [coin, setCoin] = useState('');
    const [price, setPrice] = useState('');
    const [deadline, setDeadline] = useState('');
    const [oracleAddress, setOracleAddress] = useState('');
    const [success, setSuccess] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const addressStr = address ? String(address) : '';

    // Build question from structured inputs
    const question = coin && price && deadline
        ? `Will ${coin} reach $${formatPrice(price)} by ${new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}?`
        : '';

    // Compute minimum deadline: tomorrow
    const minDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const handleSubmit = async (e: FormEvent): Promise<void> => {
        e.preventDefault();
        setSuccess(false);

        if (!coin || !price || !deadline) return;

        const blocks = deadlineToBlocks(deadline);
        const oracle = oracleAddress || addressStr;
        if (!oracle) return;

        try {
            await createMarket(question, blocks, oracle, {
                coin,
                targetPrice: Number(price),
                deadline,
            });
            setSuccess(true);
            setCoin('');
            setPrice('');
            setDeadline('');
        } catch {
            // error is set by the hook
        }
    };

    const isValid = !!coin && !!price && Number(price) > 0 && !!deadline;

    return (
        <Card className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-[#f7931a] mb-6">Create New Market</h2>

            {/* Question preview */}
            <div className="mb-6 bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl px-5 py-4">
                <p className="text-xs uppercase tracking-wider text-[#555] mb-2">Your market question</p>
                <p className={`text-lg font-medium leading-relaxed ${question ? 'text-[#e4e4ec]' : 'text-[#333]'}`}>
                    {question || 'Will [COIN] reach $[PRICE] by [DEADLINE]?'}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Coin selector */}
                <div>
                    <label className="block text-sm font-medium text-[#8888a0] mb-2">
                        Coin
                    </label>
                    <CoinSelector value={coin} onChange={setCoin} />
                </div>

                {/* Target price */}
                <div>
                    <label className="block text-sm font-medium text-[#8888a0] mb-2">
                        Target Price (USD)
                    </label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]">$</span>
                        <input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="150000"
                            min="0.01"
                            step="any"
                            className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl pl-8 pr-4 py-3 text-[#e4e4ec] placeholder-[#555] focus:border-[#f7931a] focus:outline-none transition-colors"
                            required
                        />
                    </div>
                </div>

                {/* Deadline date picker */}
                <div>
                    <label className="block text-sm font-medium text-[#8888a0] mb-2">
                        Deadline
                    </label>
                    <input
                        type="date"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        min={minDate}
                        className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl px-4 py-3 text-[#e4e4ec] placeholder-[#555] focus:border-[#f7931a] focus:outline-none transition-colors [color-scheme:dark]"
                        required
                    />
                    {deadline && (
                        <p className="text-xs text-[#555] mt-1">
                            ~{deadlineToBlocks(deadline).toLocaleString()} blocks from now
                        </p>
                    )}
                </div>

                {/* Advanced options */}
                <div>
                    <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="text-xs text-[#555] hover:text-[#8888a0] transition-colors cursor-pointer flex items-center gap-1"
                    >
                        <svg className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        Advanced options
                    </button>
                    {showAdvanced && (
                        <div className="mt-3">
                            <label className="block text-sm font-medium text-[#8888a0] mb-2">
                                Oracle Address (who resolves the market)
                            </label>
                            <input
                                type="text"
                                value={oracleAddress}
                                onChange={(e) => setOracleAddress(e.target.value)}
                                placeholder="Leave empty to use your own address"
                                className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl px-4 py-3 text-[#e4e4ec] placeholder-[#555] focus:border-[#f7931a] focus:outline-none transition-colors"
                            />
                        </div>
                    )}
                </div>

                {error && (
                    <div className="text-red-400 text-sm bg-red-400/10 px-4 py-2 rounded-lg">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="text-green-400 text-sm bg-green-400/10 px-4 py-3 rounded-lg">
                        <p className="font-medium">Transaction submitted!</p>
                        <p className="text-green-400/80 mt-1">
                            Your market will appear on the Markets page after the next block confirmation (~10 min).
                        </p>
                    </div>
                )}

                <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={loading || !addressStr || !isValid}
                >
                    {loading ? 'Creating...' : 'Create Market'}
                </Button>

                {!addressStr && (
                    <p className="text-center text-sm text-[#8888a0]">
                        Connect your wallet to create a market
                    </p>
                )}
            </form>
        </Card>
    );
}
