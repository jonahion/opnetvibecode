import { useState, useEffect, useCallback } from 'react';
import { networks, Network } from '@btc-vision/bitcoin';
import { useWalletConnect } from '@btc-vision/walletconnect';

export function useNetwork(): {
    network: Network;
    switchNetwork: (n: Network) => void;
    isConnected: boolean;
} {
    const { network: walletNetwork, address } = useWalletConnect();
    const [network, setNetwork] = useState<Network>(networks.opnetTestnet);

    const isConnected = address !== null;

    useEffect(() => {
        if (isConnected && walletNetwork && walletNetwork !== network) {
            setNetwork(walletNetwork);
        }
    }, [walletNetwork, isConnected, network]);

    const switchNetwork = useCallback((newNetwork: Network) => {
        setNetwork(newNetwork);
    }, []);

    return { network, switchNetwork, isConnected };
}
