import { useState, useCallback } from 'react';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { networks } from '@btc-vision/bitcoin';
import { Address, ABICoder } from '@btc-vision/transaction';
import { JSONRpcProvider, getContract, BaseContractProperties, ABIDataTypes } from 'opnet';
import type { BitcoinInterfaceAbi } from 'opnet';
import { useNetwork } from './useNetwork';
import { getNetworkConfig } from '../config';
import { PREDICTION_MARKET_ABI } from '../abi/PredictionMarketABI';
import { MarketData, MarketStatus, MarketOutcome, UserPosition, MarketMetadata } from '../types';
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

/** Convert a u256 value (decimal or BigInt) back to a 0x-prefixed hex address string. */
function u256ToHex(value: unknown): string {
    try {
        const n = BigInt(String(value));
        return '0x' + n.toString(16).padStart(64, '0');
    } catch {
        // If it's already hex-like, return as-is
        const s = String(value);
        return s.startsWith('0x') ? s : '0x' + s;
    }
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
    sender?: Address,
): AnyContract {
    const provider = createProvider(network);
    const contract = getContract<BaseContractProperties>(
        contractAddress,
        PREDICTION_MARKET_ABI as BitcoinInterfaceAbi,
        provider,
        network,
        sender,
    ) as unknown as AnyContract;
    return contract;
}

export type PendingTxType = 'createMarket' | 'placeBet' | 'resolveMarket' | 'claimWinnings' | 'unknown';

export interface PendingTx {
    txId: string;
    from: string;
    firstSeen: Date;
    /** Decoded function name if recognized. */
    txType: PendingTxType;
    /** Question string from createMarket calls. */
    question?: string;
    /** Market ID from placeBet / resolveMarket / claimWinnings calls. */
    marketId?: bigint;
    /** Bet outcome from placeBet calls (1=YES, 2=NO). */
    betOutcome?: number;
    /** Bet amount from placeBet calls. */
    betAmount?: bigint;
}

/** Pre-compute function selectors (SHA256 first 4 bytes of canonical signature). */
const abiCoder = new ABICoder();
const SELECTOR_CREATE_MARKET = abiCoder.encodeSelector('createMarket(string,uint64,address)');
const SELECTOR_PLACE_BET = abiCoder.encodeSelector('placeBet(uint256,uint256,uint256)');
const SELECTOR_RESOLVE_MARKET = abiCoder.encodeSelector('resolveMarket(uint256,uint256)');
const SELECTOR_CLAIM_WINNINGS = abiCoder.encodeSelector('claimWinnings(uint256)');

function calldataSelector(calldata: Uint8Array): string {
    return Array.from(calldata.subarray(0, 4)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface DecodedCalldata {
    txType: PendingTxType;
    question?: string;
    marketId?: bigint;
    betOutcome?: number;
    betAmount?: bigint;
}

function decodePendingCalldata(calldata: Uint8Array): DecodedCalldata {
    if (calldata.length < 4) return { txType: 'unknown' };
    const sel = calldataSelector(calldata);
    const params = calldata.subarray(4);
    try {
        if (sel === SELECTOR_CREATE_MARKET) {
            const decoded = abiCoder.decodeData(params, [ABIDataTypes.STRING, ABIDataTypes.UINT64, ABIDataTypes.ADDRESS]);
            return { txType: 'createMarket', question: decoded[0] as string };
        }
        if (sel === SELECTOR_PLACE_BET) {
            const decoded = abiCoder.decodeData(params, [ABIDataTypes.UINT256, ABIDataTypes.UINT256, ABIDataTypes.UINT256]);
            return {
                txType: 'placeBet',
                marketId: decoded[0] as bigint,
                betOutcome: Number(decoded[1] as bigint),
                betAmount: decoded[2] as bigint,
            };
        }
        if (sel === SELECTOR_RESOLVE_MARKET) {
            const decoded = abiCoder.decodeData(params, [ABIDataTypes.UINT256, ABIDataTypes.UINT256]);
            return { txType: 'resolveMarket', marketId: decoded[0] as bigint };
        }
        if (sel === SELECTOR_CLAIM_WINNINGS) {
            const decoded = abiCoder.decodeData(params, [ABIDataTypes.UINT256]);
            return { txType: 'claimWinnings', marketId: decoded[0] as bigint };
        }
    } catch {
        // decoding failed — return unknown
    }
    return { txType: 'unknown' };
}

export function usePredictionMarket(): {
    loading: boolean;
    error: string | null;
    fetchMarketCount: () => Promise<bigint>;
    fetchMarket: (marketId: bigint) => Promise<MarketData>;
    fetchUserPosition: (marketId: bigint) => Promise<UserPosition>;
    fetchCurrentBlock: () => Promise<bigint>;
    fetchCallerAddress: () => Promise<string>;
    fetchPendingTxs: () => Promise<PendingTx[]>;
    createMarket: (question: string, endBlock: bigint, oracle: string, metadata?: MarketMetadata) => Promise<void>;
    placeBet: (marketId: bigint, outcome: MarketOutcome, amount: bigint) => Promise<void>;
    resolveMarket: (marketId: bigint, outcome: MarketOutcome) => Promise<void>;
    claimWinnings: (marketId: bigint) => Promise<void>;
} {
    const { network } = useNetwork();
    const { address, walletAddress } = useWalletConnect();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const contractAddress = 'opt1sqr39k8n70qaukcwz2cr8jvulj3tjp28j7ghahs9q';



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
            creator: u256ToHex(props.creator),
            endBlock: props.endBlock as bigint,
            oracle: u256ToHex(props.oracle),
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

    const fetchCurrentBlock = useCallback(async (): Promise<bigint> => {
        const provider = createProvider(network);
        const blockNumber = await provider.getBlockNumber();
        return BigInt(blockNumber);
    }, [network]);

    /** Returns the connected wallet's tx.sender address as a hex string (0x-prefixed). */
    const fetchCallerAddress = useCallback(async (): Promise<string> => {
        const contract = createContract(contractAddress, network);
        const result = await contract.getCallerAddressView();
        if (result.revert) throw new Error('Failed to fetch caller address');
        return u256ToHex(result.properties.callerAddress);
    }, [network, contractAddress]);

    /** Fetch pending (unconfirmed) transactions targeting our contract from the mempool. */
    const fetchPendingTxs = useCallback(async (): Promise<PendingTx[]> => {
        try {
            const provider = createProvider(network);
            const txs = await provider.getLatestPendingTransactions({ limit: 50 });
            const pending: PendingTx[] = [];
            for (const tx of txs) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const opnetTx = tx as any;
                if (opnetTx.contractAddress && opnetTx.contractAddress === contractAddress) {
                    const decoded = opnetTx.calldata instanceof Uint8Array
                        ? decodePendingCalldata(opnetTx.calldata)
                        : { txType: 'unknown' as PendingTxType };
                    pending.push({
                        txId: tx.id,
                        from: opnetTx.from ?? '',
                        firstSeen: tx.firstSeen,
                        ...decoded,
                    });
                }
            }
            return pending;
        } catch {
            return [];
        }
    }, [network, contractAddress]);

    const createMarket = useCallback(async (
        question: string,
        blocksFromNow: bigint,
        oracle: string,
        metadata?: MarketMetadata,
    ): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            if (!address) throw new Error('Wallet not connected');
            const provider = createProvider(network);
            const currentBlock = await provider.getBlockNumber();
            const endBlock = BigInt(currentBlock) + blocksFromNow;

            const contract = createContract(contractAddress, network);
            // Empty oracle → send zero address so contract uses tx.sender
            const oracleAddr = oracle ? hexToAddress(oracle) : Address.wrap(new Uint8Array(32));
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
                void saveMarketQuestion(marketId, question, metadata);
            } else {
                // Fallback: save for next market count
                try {
                    const count = await fetchMarketCount();
                    void saveMarketQuestion(count, question, metadata);
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

            // Build a full Address with legacy public key so the simulation
            // knows the real tx.sender (needed for oracle identity check).
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const opwallet = (window as any).opnet;
            let sender: Address | undefined;
            if (opwallet) {
                try {
                    const [pubKey, mldsaPubKey] = await Promise.all([
                        opwallet.getPublicKey() as Promise<string>,
                        opwallet.getMLDSAPublicKey() as Promise<string>,
                    ]);
                    if (mldsaPubKey && pubKey) {
                        sender = Address.fromString(mldsaPubKey, pubKey);
                    }
                } catch {
                    // best-effort; proceed without sender
                }
            }

            const contract = createContract(contractAddress, network, sender);
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

            // Build a full Address with legacy public key so the simulation
            // knows the real tx.sender (needed for bet ownership check).
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const opwallet = (window as any).opnet;
            let sender: Address | undefined;
            if (opwallet) {
                try {
                    const [pubKey, mldsaPubKey] = await Promise.all([
                        opwallet.getPublicKey() as Promise<string>,
                        opwallet.getMLDSAPublicKey() as Promise<string>,
                    ]);
                    if (mldsaPubKey && pubKey) {
                        sender = Address.fromString(mldsaPubKey, pubKey);
                    }
                } catch {
                    // best-effort; proceed without sender
                }
            }

            const contract = createContract(contractAddress, network, sender);
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
        fetchCurrentBlock,
        fetchCallerAddress,
        fetchPendingTxs,
        createMarket,
        placeBet,
        resolveMarket,
        claimWinnings,
    };
}
