import { useState, FormEvent } from 'react';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { usePredictionMarket } from '../../hooks/usePredictionMarket';

export function CreateMarketForm(): React.JSX.Element {
    const { address } = useWalletConnect();
    const { createMarket, loading, error } = usePredictionMarket();
    const [question, setQuestion] = useState('');
    const [blocksFromNow, setBlocksFromNow] = useState('144');
    const [oracleAddress, setOracleAddress] = useState('');
    const [success, setSuccess] = useState(false);

    const addressStr = address ? String(address) : '';

    const handleSubmit = async (e: FormEvent): Promise<void> => {
        e.preventDefault();
        setSuccess(false);

        const blocks = BigInt(blocksFromNow);
        const oracle = oracleAddress || addressStr;
        if (!oracle) return;

        await createMarket(question, blocks, oracle);
        setSuccess(true);
        setQuestion('');
    };

    return (
        <Card className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-[#f7931a] mb-6">Create New Market</h2>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-[#8888a0] mb-2">
                        Question
                    </label>
                    <input
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Will BTC reach $150,000 by end of Q3 2026?"
                        className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl px-4 py-3 text-[#e4e4ec] placeholder-[#555] focus:border-[#f7931a] focus:outline-none transition-colors"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-[#8888a0] mb-2">
                        Duration (blocks from now, ~10 min/block)
                    </label>
                    <input
                        type="number"
                        value={blocksFromNow}
                        onChange={(e) => setBlocksFromNow(e.target.value)}
                        placeholder="144"
                        min="1"
                        className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl px-4 py-3 text-[#e4e4ec] placeholder-[#555] focus:border-[#f7931a] focus:outline-none transition-colors"
                        required
                    />
                    <p className="text-xs text-[#555] mt-1">
                        144 blocks ~ 24 hours
                    </p>
                </div>

                <div>
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

                {error && (
                    <div className="text-red-400 text-sm bg-red-400/10 px-4 py-2 rounded-lg">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="text-green-400 text-sm bg-green-400/10 px-4 py-2 rounded-lg">
                        Market created successfully!
                    </div>
                )}

                <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={loading || !addressStr || !question}
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
