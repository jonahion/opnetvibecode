import { useState, useEffect, useCallback } from 'react';
import { networks, Network } from '@btc-vision/bitcoin';
import { useWalletConnect } from '@btc-vision/walletconnect';

function resolveNetwork(network: Network): Network {
    const bech32 = network.bech32;
    if (bech32 === networks.bitcoin.bech32) return networks.bitcoin;
    if (bech32 === networks.opnetTestnet.bech32) return networks.opnetTestnet;
    if (bech32 === networks.regtest.bech32) return networks.regtest;
    if (bech32 === networks.testnet.bech32) return networks.testnet;
    return network;
}

export function useNetwork(): {
    network: Network;
    switchNetwork: (n: Network) => void;
    isConnected: boolean;
} {
    const { network: walletNetwork, address } = useWalletConnect();
    const [network, setNetwork] = useState<Network>(networks.opnetTestnet);

    const isConnected = address !== null;

    useEffect(() => {
        if (isConnected && walletNetwork) {
            const resolved = resolveNetwork(walletNetwork);
            if (resolved.bech32 !== network.bech32) {
                setNetwork(resolved);
            }
        }
    }, [walletNetwork, isConnected, network]);

    const switchNetwork = useCallback((newNetwork: Network) => {
        setNetwork(newNetwork);
    }, []);

    return { network, switchNetwork, isConnected };
}
