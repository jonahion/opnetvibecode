import { useState, useRef, useEffect, FormEvent } from 'react';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { usePredictionMarket } from '../../hooks/usePredictionMarket';
import { MarketCategory } from '../../types';
import { searchCoins } from '../../utils/coinList';
import { useTheme } from '../../hooks/useTheme';

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

function CoinAutocomplete({ value, onChange }: { value: string; onChange: (v: string) => void }): React.JSX.Element {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const ref = useRef<HTMLDivElement>(null);

    const suggestions = searchCoins(inputValue, 10);

    useEffect(() => {
        setInputValue(value);
    }, [value]);

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
                value={inputValue}
                onChange={(e) => {
                    setInputValue(e.target.value);
                    setOpen(true);
                    const upper = e.target.value.toUpperCase().trim();
                    if (upper && suggestions.some((s) => s.symbol === upper)) {
                        onChange(upper);
                    } else {
                        onChange(e.target.value.toUpperCase().trim());
                    }
                }}
                onFocus={() => setOpen(true)}
                placeholder="Type a coin symbol (e.g. BTC, ETH, SOL)..."
                className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-btc-orange)] focus:outline-none transition-colors"
            />
            {open && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-bg-card-hover)] border border-[var(--color-border)] rounded-xl overflow-hidden z-10 shadow-lg max-h-64 overflow-y-auto">
                    {suggestions.map((coin) => (
                        <button
                            key={coin.symbol}
                            onClick={() => {
                                onChange(coin.symbol);
                                setInputValue(coin.symbol);
                                setOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer flex items-center justify-between ${
                                value === coin.symbol
                                    ? 'bg-[var(--color-btc-orange)]/20 text-[var(--color-btc-orange)] font-semibold'
                                    : 'text-[var(--color-text-primary)] hover:bg-[var(--color-btc-orange)]/10 hover:text-[var(--color-btc-orange)]'
                            }`}
                        >
                            <span className="font-semibold">{coin.symbol}</span>
                            <span className="text-xs text-[var(--color-text-muted)] ml-2">{coin.name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function CategoryToggle({ value, onChange }: { value: MarketCategory; onChange: (v: MarketCategory) => void }): React.JSX.Element {
    return (
        <div className="flex bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-xl p-1 mb-6">
            <button
                type="button"
                onClick={() => onChange('price')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    value === 'price'
                        ? 'bg-[var(--color-btc-orange)] text-black'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
            >
                Price Prediction
            </button>
            <button
                type="button"
                onClick={() => onChange('event')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    value === 'event'
                        ? 'bg-[var(--color-btc-orange)] text-black'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
            >
                Event Prediction
            </button>
        </div>
    );
}

const inputClasses = 'w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-btc-orange)] focus:outline-none transition-colors';

export function CreateMarketForm(): React.JSX.Element {
    const { address } = useWalletConnect();
    const { createMarket, loading, error } = usePredictionMarket();
    const { theme } = useTheme();
    const [category, setCategory] = useState<MarketCategory>('price');
    const [coin, setCoin] = useState('BTC');
    const [price, setPrice] = useState('');
    const [deadline, setDeadline] = useState('');
    const [eventQuestion, setEventQuestion] = useState('');
    const [oracleAddress, setOracleAddress] = useState('');
    const [success, setSuccess] = useState(false);

    const addressStr = address ? String(address) : '';

    // Format deadline for display
    const deadlineLabel = deadline
        ? new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '';

    // Build question preview progressively based on category
    let questionPreview = '';
    let hasUserInput = false;
    if (category === 'price') {
        const coinPart = coin || '[COIN]';
        const pricePart = price && formatPrice(price) ? `$${formatPrice(price)}` : '$[PRICE]';
        const datePart = deadlineLabel || '[DEADLINE]';
        questionPreview = `Will ${coinPart} reach ${pricePart} by ${datePart}?`;
        hasUserInput = !!coin || !!price || !!deadline;
    } else {
        const eventPart = eventQuestion.trim() || '[THE EVENT HAPPEN]';
        const datePart = deadlineLabel || '[DEADLINE]';
        questionPreview = `Will ${eventPart} by ${datePart}?`;
        hasUserInput = !!eventQuestion.trim() || !!deadline;
    }

    // Final question string for submission (only when all required fields are filled)
    const submittableQuestion = category === 'price'
        ? (coin && price && formatPrice(price) && deadline
            ? `Will ${coin} reach $${formatPrice(price)} by ${deadlineLabel}?`
            : '')
        : (eventQuestion.trim()
            ? (deadlineLabel ? `Will ${eventQuestion.trim()} by ${deadlineLabel}?` : eventQuestion.trim())
            : '');

    // Compute minimum deadline: tomorrow
    const minDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const handleSubmit = async (e: FormEvent): Promise<void> => {
        e.preventDefault();
        setSuccess(false);

        if (!submittableQuestion || !deadline) return;
        if (category === 'price' && (!coin || !price)) return;

        const blocks = deadlineToBlocks(deadline);
        if (!addressStr) return;
        // Pass empty string when no custom oracle → contract will use tx.sender
        const oracle = oracleAddress.trim() || '';

        try {
            await createMarket(submittableQuestion, blocks, oracle, {
                category,
                coin: category === 'price' ? coin : undefined,
                targetPrice: category === 'price' ? Number(price) : undefined,
                deadline,
            });
            setSuccess(true);
            setCoin('BTC');
            setPrice('');
            setDeadline('');
            setEventQuestion('');
        } catch {
            // error is set by the hook
        }
    };

    const isValid = category === 'price'
        ? !!coin && !!price && Number(price) > 0 && !!deadline
        : !!eventQuestion.trim() && !!deadline;

    return (
        <Card className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-[var(--color-btc-orange)] mb-6">Create New Market</h2>

            <CategoryToggle value={category} onChange={setCategory} />

            {/* Question preview */}
            <div className="mb-6 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-xl px-5 py-4">
                <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Your market question</p>
                <p className={`text-lg font-medium leading-relaxed ${hasUserInput ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                    {questionPreview}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {category === 'price' ? (
                    <>
                        {/* Coin autocomplete */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                Coin
                            </label>
                            <CoinAutocomplete value={coin} onChange={setCoin} />
                        </div>

                        {/* Target price */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                Target Price (USD)
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">$</span>
                                <input
                                    type="number"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    placeholder="150000"
                                    min="0.01"
                                    step="any"
                                    className={`${inputClasses} pl-8 pr-4`}
                                    required
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    /* Event question */
                    <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                            Event
                        </label>
                        <input
                            type="text"
                            value={eventQuestion}
                            onChange={(e) => setEventQuestion(e.target.value)}
                            placeholder="Bitcoin ETF be approved by SEC"
                            className={inputClasses}
                            required
                        />
                    </div>
                )}

                {/* Deadline date picker */}
                <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                        Deadline
                    </label>
                    <input
                        type="date"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        min={minDate}
                        className={`${inputClasses} ${theme === 'dark' ? '[color-scheme:dark]' : '[color-scheme:light]'}`}
                        required
                    />
                    {deadline && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                            ~{deadlineToBlocks(deadline).toLocaleString()} blocks from now
                        </p>
                    )}
                </div>

                {/* Oracle address */}
                <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                        Oracle Address
                    </label>
                    <input
                        type="text"
                        value={oracleAddress}
                        onChange={(e) => setOracleAddress(e.target.value)}
                        placeholder={addressStr ? `Default: your wallet (${addressStr.slice(0, 8)}...)` : 'Who resolves this market'}
                        className={`${inputClasses} font-mono text-sm`}
                    />
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        The oracle decides the outcome after the deadline. Leave empty to use your own wallet.
                    </p>
                </div>

                {error && (
                    <div className="text-red-400 text-sm bg-red-400/10 px-4 py-2 rounded-lg">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="text-green-400 bg-green-400/10 border border-green-400/30 px-5 py-4 rounded-xl">
                        <p className="font-bold text-base mb-2">Transaction submitted!</p>
                        <div className="flex items-start gap-3 bg-green-400/10 rounded-lg px-4 py-3">
                            <svg className="w-5 h-5 mt-0.5 shrink-0 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-sm text-green-300">
                                <span className="font-semibold">Your market will appear after the next block is mined (~10 minutes).</span>
                                {' '}OPNet transactions require one block confirmation before they become visible.
                            </p>
                        </div>
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
                    <p className="text-center text-sm text-[var(--color-text-secondary)]">
                        Connect your wallet to create a market
                    </p>
                )}
            </form>
        </Card>
    );
}
