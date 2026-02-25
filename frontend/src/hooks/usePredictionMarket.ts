import { useState, useCallback } from 'react';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { networks } from '@btc-vision/bitcoin';
import { JSONRpcProvider, getContract, BaseContractProperties } from 'opnet';
import type { BitcoinInterfaceAbi } from 'opnet';
import { Address } from '@btc-vision/transaction';
import { useNetwork } from './useNetwork';
import { getNetworkConfig } from '../config';
import { PREDICTION_MARKET_ABI } from '../abi/PredictionMarketABI';
import { MarketData, MarketStatus, MarketOutcome, UserPosition } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContract = ReturnType<typeof getContract<BaseContractProperties>> & Record<string, (...args: any[]) => Promise<any>>;

function createProvider(network: typeof networks.bitcoin): JSONRpcProvider {
    const config = getNetworkConfig(network);
    return new JSONRpcProvider({ url: config.rpcUrl, network });
}

function createContract(
    contractAddress: string,
    network: typeof networks.bitcoin,
    senderAddress?: Address,
): AnyContract {
    const provider = createProvider(network);
    return getContract<BaseContractProperties>(
        contractAddress,
        PREDICTION_MARKET_ABI as BitcoinInterfaceAbi,
        provider,
        network,
        senderAddress,
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
    const { address } = useWalletConnect();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const contractAddress = 'DEPLOY_AND_REPLACE_WITH_TESTNET_ADDRESS';

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
            question: `Market #${marketId}`,
        };
    }, [network, contractAddress]);

    const fetchUserPosition = useCallback(async (marketId: bigint): Promise<UserPosition> => {
        if (!address) throw new Error('Wallet not connected');
        const contract = createContract(contractAddress, network, address);
        const result = await contract.getUserPosition(marketId, address);
        if (result.revert) throw new Error('Failed to fetch user position');

        return {
            yesBet: result.properties.yesBet as bigint,
            noBet: result.properties.noBet as bigint,
            claimed: result.properties.claimed as boolean,
        };
    }, [network, address, contractAddress]);

    const createMarket = useCallback(async (
        question: string,
        endBlock: bigint,
        oracle: string,
    ): Promise<void> => {
        if (!address) throw new Error('Wallet not connected');
        setLoading(true);
        setError(null);
        try {
            const contract = createContract(contractAddress, network, address);
            const sim = await contract.createMarket(question, endBlock, oracle);
            if (sim.revert) throw new Error(`Create market failed: ${String(sim.revert)}`);

            await sim.sendTransaction({
                signer: null,
                mldsaSigner: null,
                refundTo: String(address),
                maximumAllowedSatToSpend: 50000n,
                network,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setError(msg);
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
        if (!address) throw new Error('Wallet not connected');
        setLoading(true);
        setError(null);
        try {
            const contract = createContract(contractAddress, network, address);
            const sim = await contract.placeBet(marketId, BigInt(outcome), amount);
            if (sim.revert) throw new Error(`Place bet failed: ${String(sim.revert)}`);

            await sim.sendTransaction({
                signer: null,
                mldsaSigner: null,
                refundTo: String(address),
                maximumAllowedSatToSpend: 50000n,
                network,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setError(msg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [network, address, contractAddress]);

    const resolveMarket = useCallback(async (
        marketId: bigint,
        outcome: MarketOutcome,
    ): Promise<void> => {
        if (!address) throw new Error('Wallet not connected');
        setLoading(true);
        setError(null);
        try {
            const contract = createContract(contractAddress, network, address);
            const sim = await contract.resolveMarket(marketId, BigInt(outcome));
            if (sim.revert) throw new Error(`Resolve market failed: ${String(sim.revert)}`);

            await sim.sendTransaction({
                signer: null,
                mldsaSigner: null,
                refundTo: String(address),
                maximumAllowedSatToSpend: 50000n,
                network,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setError(msg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [network, address, contractAddress]);

    const claimWinnings = useCallback(async (marketId: bigint): Promise<void> => {
        if (!address) throw new Error('Wallet not connected');
        setLoading(true);
        setError(null);
        try {
            const contract = createContract(contractAddress, network, address);
            const sim = await contract.claimWinnings(marketId);
            if (sim.revert) throw new Error(`Claim failed: ${String(sim.revert)}`);

            await sim.sendTransaction({
                signer: null,
                mldsaSigner: null,
                refundTo: String(address),
                maximumAllowedSatToSpend: 50000n,
                network,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setError(msg);
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
