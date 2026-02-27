import { useWalletConnect, SupportedWallets } from '@btc-vision/walletconnect';
import { Button } from '../common/Button';

function formatAddress(addr: string): string {
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function WalletButton(): React.JSX.Element {
    const { address, connectToWallet, disconnect } = useWalletConnect();

    const handleConnect = (): void => {
        connectToWallet(SupportedWallets.OP_WALLET);
    };

    const isConnected = address !== null;
    const addressStr = address ? String(address) : '';

    if (isConnected && addressStr) {
        return (
            <div className="flex items-center gap-3">
                <span className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-card-hover)] px-3 py-1.5 rounded-lg border border-[var(--color-border)]">
                    {formatAddress(addressStr)}
                </span>
                <Button variant="ghost" size="sm" onClick={disconnect}>
                    Disconnect
                </Button>
            </div>
        );
    }

    return (
        <Button onClick={handleConnect} size="sm">
            Connect OP_WALLET
        </Button>
    );
}
