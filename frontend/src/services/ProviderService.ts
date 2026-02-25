import { JSONRpcProvider } from 'opnet';
import { Network } from '@btc-vision/bitcoin';
import { getNetworkConfig, getNetworkId } from '../config';

class ProviderService {
    private static instance: ProviderService;
    private providers: Map<string, JSONRpcProvider> = new Map();

    private constructor() {}

    public static getInstance(): ProviderService {
        if (!ProviderService.instance) {
            ProviderService.instance = new ProviderService();
        }
        return ProviderService.instance;
    }

    public getProvider(network: Network): JSONRpcProvider {
        const networkId = getNetworkId(network);
        const existing = this.providers.get(networkId);
        if (existing) return existing;

        const config = getNetworkConfig(network);
        const provider = new JSONRpcProvider({ url: config.rpcUrl, network });
        this.providers.set(networkId, provider);
        return provider;
    }

    public clearCache(): void {
        this.providers.clear();
    }
}

export const providerService = ProviderService.getInstance();
