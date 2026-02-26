import { networks, Network } from '@btc-vision/bitcoin';

export interface NetworkConfig {
    name: string;
    rpcUrl: string;
    explorerUrl: string;
}

export const NETWORK_CONFIGS: Map<string, NetworkConfig> = new Map([
    ['mainnet', {
        name: 'Mainnet',
        rpcUrl: 'https://mainnet.opnet.org/api/v1/json-rpc',
        explorerUrl: 'https://explorer.opnet.org',
    }],
    ['testnet', {
        name: 'OPNet Testnet',
        rpcUrl: 'https://testnet.opnet.org/api/v1/json-rpc',
        explorerUrl: 'https://testnet-explorer.opnet.org',
    }],
    ['regtest', {
        name: 'Regtest',
        rpcUrl: 'http://localhost:9001',
        explorerUrl: 'http://localhost:3000',
    }],
]);

export function getNetworkId(network: Network): string {
    const bech32 = network.bech32;
    if (bech32 === networks.bitcoin.bech32) return 'mainnet';
    if (bech32 === networks.opnetTestnet.bech32) return 'testnet';
    if (bech32 === networks.regtest.bech32) return 'regtest';
    return 'unknown';
}

export function getNetworkConfig(network: Network): NetworkConfig {
    const id = getNetworkId(network);
    const config = NETWORK_CONFIGS.get(id);
    if (!config) throw new Error(`No config for network: ${id}`);
    return config;
}
