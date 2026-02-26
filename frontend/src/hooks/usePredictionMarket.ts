import { useState, useCallback } from 'react';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { networks } from '@btc-vision/bitcoin';
import { Address } from '@btc-vision/transaction';
import { JSONRpcProvider, getContract, BaseContractProperties } from 'opnet';
import type { BitcoinInterfaceAbi } from 'opnet';
import { useNetwork } from './useNetwork';
import { getNetworkConfig } from '../config';
import { PREDICTION_MARKET_ABI } from '../abi/PredictionMarketABI';
import { MarketData, MarketStatus, MarketOutcome, UserPosition } from '../types';
import { getMarketTitle, saveMarketQuestion } from '../utils/marketQuestions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContract = ReturnType<typeof getContract<BaseContractProperties>> & Record<string, (...args: any[]) => Promise<any>>;

function friendlyError(raw: string): string {
    if (raw.includes('Insufficient UTXOs') || raw.includes('No UTXOs found')) {
        const match = raw.match(/Available:\s*(\d+),\s*Needed:\s*(\d+)/);
        if (match) {
            const available = Number(match[1]).toLocaleString();
            const needed = Number(match[2]).toLocaleString();
            return `Insufficient funds. You have ${available} sats but this transaction requires ${needed} sats (bet + gas + fees). Fund your wallet with more testnet sats and try again.`;
        }
        return 'Insufficient funds. Your wallet does not have enough sats to cover the bet amount plus gas and fees. Fund your wallet and try again.';
    }
    if (raw.includes('Could not decode transaction')) {
        return 'Transaction rejected by the network. This usually means your wallet has stale UTXOs. Try refreshing the page or reconnecting your wallet.';
    }
    if (raw.includes('Wallet not connected')) {
        return 'Wallet not connected. Click "Connect OP_WALLET" to continue.';
    }
    if (raw.includes('Only the designated oracle')) {
        return 'Only the designated oracle can resolve this market. Your wallet is not the oracle for this market.';
    }
    if (raw.includes('Market has not ended') || raw.includes('not ended')) {
        return 'This market has not ended yet. It can only be resolved after the end block is reached.';
    }
    if (raw.includes('Market is not open') || raw.includes('not open')) {
        return 'This market is no longer open for betting.';
    }
    if (raw.includes('Error in calling function:')) {
        const reason = raw.replace(/.*Error in calling function:\s*/i, '').replace(/\s*at\s+src\/.*$/i, '').trim();
        return `Contract error: ${reason}`;
    }
    if (raw.includes('revert') || raw.includes('Simulation reverted')) {
        return `Contract call reverted: ${raw.replace(/.*revert(?:ed)?:?\s*/i, '')}`;
    }
    if (raw.includes('User rejected') || raw.includes('user rejected') || raw.includes('cancelled')) {
        return 'Transaction cancelled by user.';
    }
    return raw;
}

function hexToAddress(hex: string): Address {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
    }
    return Address.wrap(bytes);
}

function createProvider(network: typeof networks.bitcoin): JSONRpcProvider {
    const config = getNetworkConfig(network);
    const provider = new JSONRpcProvider({ url: config.rpcUrl, network });

    // Patch: fallback to OP_WALLET broadcast when RPC rejects the interaction tx.
    // OP_WALLET v1.8.1 may produce interaction txs that our RPC rejects with
    // "Could not decode transaction" but the wallet's own pushTx accepts.
    const origSend = provider.sendRawTransaction.bind(provider);
    provider.sendRawTransaction = async (tx: string, psbt: boolean) => {
        const result = await origSend(tx, psbt);
        if (result && !result.success && typeof result.result === 'string' && result.result.includes('Could not decode')) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const opwallet = (window as any).opnet?.web3?.provider;
            if (opwallet?.pushTx) {
                try {
                    const txid = await opwallet.pushTx(tx);
                    if (txid) {
                        return { success: true, result: typeof txid === 'string' ? txid : String(txid), peers: 0 };
                    }
                } catch {
                    // pushTx failed too, return original error
                }
            }
        }
        return result;
    };

    return provider;
}

function createContract(
    contractAddress: string,
    network: typeof networks.bitcoin,
): AnyContract {
    const provider = createProvider(network);
    return getContract<BaseContractProperties>(
        contractAddress,
        PREDICTION_MARKET_ABI as BitcoinInterfaceAbi,
        provider,
        network,
    ) as unknown as AnyContract;
}

export function usePredictionMarket(): {
    loading: boolean;
    error: string | null;
    fetchMarketCount: () => Promise<bigint>;
    fetchMarket: (marketId: bigint) => Promise<MarketData>;
    fetchUserPosition: (marketId: bigint) => Promise<UserPosition>;
    createMarket: (question: string, endBlock: bigint, oracle: string) => Promise<void>;
    placeBet: (marketId: bigint, outcome: MarketOutcome, amount: bigint) => Promise<void>;
    resolveMarket: (marketId: bigint, outcome: MarketOutcome) => Promise<void>;
    claimWinnings: (marketId: bigint) => Promise<void>;
} {
    const { network } = useNetwork();
    const { address, walletAddress } = useWalletConnect();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const contractAddress = 'opt1sqp68ve9ztlmjl63fk43sspzln2u0ew4auuuctw3h';

    const fetchMarketCount = useCallback(async (): Promise<bigint> => {
        const contract = createContract(contractAddress, network);
        const result = await contract.getMarketCountView();
        if (result.revert) throw new Error('Failed to fetch market count');
        return result.properties.count as bigint;
    }, [network, contractAddress]);

    const fetchMarket = useCallback(async (marketId: bigint): Promise<MarketData> => {
        const contract = createContract(contractAddress, network);
        const result = await contract.getMarket(marketId);
        if (result.revert) throw new Error(`Failed to fetch market ${marketId}`);

        const props = result.properties;
        return {
            id: marketId,
            creator: String(props.creator),
            endBlock: props.endBlock as bigint,
            oracle: String(props.oracle),
            status: Number(props.status) as MarketStatus,
            outcome: Number(props.outcome) as MarketOutcome,
            yesPool: props.yesPool as bigint,
            noPool: props.noPool as bigint,
            question: getMarketTitle(marketId),
        };
    }, [network, contractAddress]);

    const fetchUserPosition = useCallback(async (marketId: bigint): Promise<UserPosition> => {
        if (!address) throw new Error('Wallet not connected');
        const contract = createContract(contractAddress, network);
        const userAddr = hexToAddress(String(address));
        const result = await contract.getUserPosition(marketId, userAddr);
        if (result.revert) throw new Error('Failed to fetch user position');

        return {
            yesBet: result.properties.yesBet as bigint,
            noBet: result.properties.noBet as bigint,
            claimed: result.properties.claimed as boolean,
        };
    }, [network, address, contractAddress]);

    const createMarket = useCallback(async (
        question: string,
        blocksFromNow: bigint,
        oracle: string,
    ): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            if (!address) throw new Error('Wallet not connected');
            const provider = createProvider(network);
            const currentBlock = await provider.getBlockNumber();
            const endBlock = BigInt(currentBlock) + blocksFromNow;

            const contract = createContract(contractAddress, network);
            const oracleAddr = hexToAddress(oracle);
            const sim = await contract.createMarket(question, endBlock, oracleAddr);
            if (sim.revert) throw new Error(`Create market failed: ${String(sim.revert)}`);

            await sim.sendTransaction({
                signer: null,
                mldsaSigner: null,
                refundTo: walletAddress!,
                maximumAllowedSatToSpend: 50000n,
                network,
            });

            // Save question to Supabase for display
            const marketId = sim.properties?.marketId as bigint | undefined;
            if (marketId) {
                void saveMarketQuestion(marketId, question);
            } else {
                // Fallback: save for next market count
                try {
                    const count = await fetchMarketCount();
                    void saveMarketQuestion(count, question);
                } catch {
                    // best-effort
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setError(friendlyError(msg));
            throw err;
        } finally {
            setLoading(false);
        }
    }, [network, address, contractAddress]);

    const placeBet = useCallback(async (
        marketId: bigint,
        outcome: MarketOutcome,
        amount: bigint,
    ): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            if (!address) throw new Error('Wallet not connected');
            const contract = createContract(contractAddress, network);
            const sim = await contract.placeBet(marketId, BigInt(outcome), amount);
            if (sim.revert) throw new Error(`Place bet failed: ${String(sim.revert)}`);

            await sim.sendTransaction({
                signer: null,
                mldsaSigner: null,
                refundTo: walletAddress!,
                maximumAllowedSatToSpend: 50000n,
                network,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setError(friendlyError(msg));
            throw err;
        } finally {
            setLoading(false);
        }
    }, [network, address, contractAddress]);

    const resolveMarket = useCallback(async (
        marketId: bigint,
        outcome: MarketOutcome,
    ): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            if (!address) throw new Error('Wallet not connected');
            const contract = createContract(contractAddress, network);
            const sim = await contract.resolveMarket(marketId, BigInt(outcome));
            if (sim.revert) throw new Error(`Resolve market failed: ${String(sim.revert)}`);

            await sim.sendTransaction({
                signer: null,
                mldsaSigner: null,
                refundTo: walletAddress!,
                maximumAllowedSatToSpend: 50000n,
                network,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setError(friendlyError(msg));
            throw err;
        } finally {
            setLoading(false);
        }
    }, [network, address, contractAddress]);

    const claimWinnings = useCallback(async (marketId: bigint): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            if (!address) throw new Error('Wallet not connected');
            const contract = createContract(contractAddress, network);
            const sim = await contract.claimWinnings(marketId);
            if (sim.revert) throw new Error(`Claim failed: ${String(sim.revert)}`);

            await sim.sendTransaction({
                signer: null,
                mldsaSigner: null,
                refundTo: walletAddress!,
                maximumAllowedSatToSpend: 50000n,
                network,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setError(friendlyError(msg));
            throw err;
        } finally {
            setLoading(false);
        }
    }, [network, address, contractAddress]);

    return {
        loading,
        error,
        fetchMarketCount,
        fetchMarket,
        fetchUserPosition,
        createMarket,
        placeBet,
        resolveMarket,
        claimWinnings,
    };
}
