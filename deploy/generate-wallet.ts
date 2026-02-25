import { Mnemonic, MnemonicStrength } from '@btc-vision/transaction';
import { MLDSASecurityLevel } from '@btc-vision/bip32';
import { networks } from '@btc-vision/bitcoin';
import * as fs from 'fs';

const network = networks.opnetTestnet;

console.log('Generating new OPNet testnet wallet...\n');

const mnemonic = Mnemonic.generate(
    MnemonicStrength.MAXIMUM,
    '',
    network,
    MLDSASecurityLevel.LEVEL2,
);

const wallet = mnemonic.derive(0);

console.log('=== SAVE THIS SECURELY ===');
console.log('Mnemonic:', mnemonic.phrase);
console.log('========================\n');
console.log('Taproot address (p2tr):', wallet.p2tr);
console.log('SegWit address (p2wpkh):', wallet.p2wpkh);
console.log('\nFund this taproot address with testnet BTC from OPNet testnet faucet.');
console.log('OPNet testnet: https://testnet.opnet.org\n');

// Save to .env file (gitignored)
const envContent = `MNEMONIC="${mnemonic.phrase}"
NETWORK=opnetTestnet
`;

fs.writeFileSync('.env', envContent);
console.log('Saved mnemonic to deploy/.env (make sure this is gitignored!)');

mnemonic.zeroize();
wallet.zeroize();
