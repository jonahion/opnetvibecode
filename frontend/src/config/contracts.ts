import { networks, Network } from '@btc-vision/bitcoin';

export interface ContractAddresses {
    predictionMarket: string;
}

const CONTRACT_ADDRESSES: Map<string, ContractAddresses> = new Map([
    ['testnet', {
        predictionMarket: 'DEPLOY_AND_REPLACE_WITH_TESTNET_ADDRESS',
    }],
    ['regtest', {
        predictionMarket: 'DEPLOY_AND_REPLACE_WITH_REGTEST_ADDRESS',
    }],
]);

function networkKey(network: Network): string {
    if (network === networks.bitcoin) return 'mainnet';
    if (network === networks.opnetTestnet) return 'testnet';
    if (network === networks.regtest) return 'regtest';
    return 'unknown';
}

export function getContractAddress(
    contract: keyof ContractAddresses,
    network: Network,
): string {
    const key = networkKey(network);
    const addresses = CONTRACT_ADDRESSES.get(key);
    if (!addresses) throw new Error(`No addresses for network: ${key}`);
    const address = addresses[contract];
    if (!address || address.startsWith('DEPLOY_')) {
        throw new Error(`Contract ${contract} not deployed on ${key}`);
    }
    return address;
}
