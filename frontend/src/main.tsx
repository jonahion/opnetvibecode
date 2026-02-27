import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WalletConnectProvider } from '@btc-vision/walletconnect';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './hooks/useTheme';
import { App } from './App';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
    <StrictMode>
        <ThemeProvider>
            <WalletConnectProvider theme="dark">
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </WalletConnectProvider>
        </ThemeProvider>
    </StrictMode>,
);
