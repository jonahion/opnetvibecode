import { Mnemonic, TransactionFactory, OPNetLimitedProvider } from '@btc-vision/transaction';
import { MLDSASecurityLevel } from '@btc-vision/bip32';
import { networks } from '@btc-vision/bitcoin';
import { JSONRpcProvider } from 'opnet';
import * as fs from 'fs';
import * as path from 'path';

// --- Configuration ---
const MNEMONIC = process.env.MNEMONIC;
if (!MNEMONIC) {
    console.error('ERROR: Set MNEMONIC environment variable or create a .env file.');
    console.error('Run: npm run generate-wallet');
    process.exit(1);
}

const network = networks.opnetTestnet;
const RPC_URL = 'https://testnet.opnet.org';
const WASM_PATH = path.resolve('../contracts/prediction-market/build/PredictionMarket.wasm');

async function main(): Promise<void> {
    console.log('=== OPNet Contract Deployment ===\n');

    // 1. Load wallet
    console.log('Loading wallet from mnemonic...');
    const mnemonic = new Mnemonic(MNEMONIC, '', network, MLDSASecurityLevel.LEVEL2);
    const wallet = mnemonic.derive(0);
    console.log('Deployer address:', wallet.p2tr);

    // 2. Read WASM bytecode
    console.log('Reading contract bytecode...');
    if (!fs.existsSync(WASM_PATH)) {
        console.error(`ERROR: WASM file not found at ${WASM_PATH}`);
        console.error('Run: cd ../contracts/prediction-market && npm run build');
        process.exit(1);
    }
    const bytecode = new Uint8Array(fs.readFileSync(WASM_PATH));
    console.log(`Bytecode size: ${bytecode.length} bytes`);

    // 3. Fetch UTXOs
    console.log('\nFetching UTXOs...');
    const limitedProvider = new OPNetLimitedProvider(RPC_URL);
    let utxos;
    try {
        utxos = await limitedProvider.fetchUTXO({
            address: wallet.p2tr,
            minAmount: 50_000n,
            requestedAmount: 500_000n,
        });
    } catch {
        console.error('\nERROR: No UTXOs found. Fund your wallet first.');
        console.error(`Address: ${wallet.p2tr}`);
        console.error('Get testnet BTC from the OPNet testnet faucet.');
        mnemonic.zeroize();
        wallet.zeroize();
        process.exit(1);
    }

    if (utxos.length === 0) {
        console.error('\nERROR: No UTXOs with sufficient balance.');
        console.error(`Address: ${wallet.p2tr}`);
        mnemonic.zeroize();
        wallet.zeroize();
        process.exit(1);
    }

    const totalBalance = utxos.reduce((sum, u) => sum + u.value, 0n);
    console.log(`Found ${utxos.length} UTXO(s), total: ${totalBalance} sats`);

    // 4. Get challenge
    console.log('\nFetching epoch challenge...');
    const rpcProvider = new JSONRpcProvider({ url: RPC_URL, network });
    const challenge = await rpcProvider.getChallenge();
    console.log('Challenge obtained.');

    // 5. Build deployment transaction
    console.log('\nBuilding deployment transaction...');
    const factory = new TransactionFactory();

    const result = await factory.signDeployment({
        signer: wallet.keypair,
        mldsaSigner: wallet.mldsaKeypair,
        network: network,
        from: wallet.p2tr,
        bytecode: bytecode,
        utxos: utxos,
        challenge: challenge,
        feeRate: 5,
        priorityFee: 330n,
        gasSatFee: 10_000n,
        linkMLDSAPublicKeyToAddress: true,
        revealMLDSAPublicKey: true,
    });

    console.log('\nContract address:', result.contractAddress);
    console.log('Contract public key:', result.contractPubKey);

    // 6. Broadcast transactions
    console.log('\nBroadcasting funding transaction...');
    const fundingResult = await limitedProvider.broadcastTransaction(
        result.transaction[0],
        false,
    );
    console.log('Funding TX:', fundingResult?.result ?? 'broadcast sent');

    console.log('Broadcasting deployment transaction...');
    const deployResult = await limitedProvider.broadcastTransaction(
        result.transaction[1],
        false,
    );
    console.log('Deployment TX:', deployResult?.result ?? 'broadcast sent');

    // 7. Save result
    const deploymentInfo = {
        contractAddress: result.contractAddress,
        contractPubKey: result.contractPubKey,
        network: 'opnetTestnet',
        deployedAt: new Date().toISOString(),
    };

    fs.writeFileSync('deployment.json', JSON.stringify(deploymentInfo, null, 2));
    console.log('\n=== Deployment successful! ===');
    console.log('Contract address saved to deploy/deployment.json');
    console.log(`\nUpdate frontend contract address in:`);
    console.log('  frontend/src/hooks/usePredictionMarket.ts');
    console.log(`  const contractAddress = '${result.contractAddress}';`);

    // Cleanup
    mnemonic.zeroize();
    wallet.zeroize();
}

main().catch((err) => {
    console.error('Deployment failed:', err);
    process.exit(1);
});
