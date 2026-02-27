import { ABIDataTypes, BitcoinAbiTypes } from 'opnet';
import type { BitcoinInterfaceAbi } from 'opnet';

export const PREDICTION_MARKET_ABI: BitcoinInterfaceAbi = [
    {
        type: BitcoinAbiTypes.Function,
        name: 'createMarket',
        inputs: [
            { name: 'question', type: ABIDataTypes.STRING },
            { name: 'endBlock', type: ABIDataTypes.UINT64 },
            { name: 'oracle', type: ABIDataTypes.ADDRESS },
        ],
        outputs: [
            { name: 'marketId', type: ABIDataTypes.UINT256 },
        ],
    },
    {
        type: BitcoinAbiTypes.Function,
        name: 'placeBet',
        inputs: [
            { name: 'marketId', type: ABIDataTypes.UINT256 },
            { name: 'outcome', type: ABIDataTypes.UINT256 },
            { name: 'amount', type: ABIDataTypes.UINT256 },
        ],
        outputs: [
            { name: 'success', type: ABIDataTypes.BOOL },
        ],
    },
    {
        type: BitcoinAbiTypes.Function,
        name: 'resolveMarket',
        inputs: [
            { name: 'marketId', type: ABIDataTypes.UINT256 },
            { name: 'outcome', type: ABIDataTypes.UINT256 },
        ],
        outputs: [
            { name: 'success', type: ABIDataTypes.BOOL },
        ],
    },
    {
        type: BitcoinAbiTypes.Function,
        name: 'claimWinnings',
        inputs: [
            { name: 'marketId', type: ABIDataTypes.UINT256 },
        ],
        outputs: [
            { name: 'amount', type: ABIDataTypes.UINT256 },
        ],
    },
    {
        type: BitcoinAbiTypes.Function,
        name: 'getMarket',
        inputs: [
            { name: 'marketId', type: ABIDataTypes.UINT256 },
        ],
        outputs: [
            { name: 'creator', type: ABIDataTypes.UINT256 },
            { name: 'endBlock', type: ABIDataTypes.UINT64 },
            { name: 'oracle', type: ABIDataTypes.UINT256 },
            { name: 'status', type: ABIDataTypes.UINT256 },
            { name: 'outcome', type: ABIDataTypes.UINT256 },
            { name: 'yesPool', type: ABIDataTypes.UINT256 },
            { name: 'noPool', type: ABIDataTypes.UINT256 },
        ],
    },
    {
        type: BitcoinAbiTypes.Function,
        name: 'getUserPosition',
        inputs: [
            { name: 'marketId', type: ABIDataTypes.UINT256 },
            { name: 'user', type: ABIDataTypes.ADDRESS },
        ],
        outputs: [
            { name: 'yesBet', type: ABIDataTypes.UINT256 },
            { name: 'noBet', type: ABIDataTypes.UINT256 },
            { name: 'claimed', type: ABIDataTypes.BOOL },
        ],
    },
    {
        type: BitcoinAbiTypes.Function,
        name: 'getMarketCountView',
        inputs: [],
        outputs: [
            { name: 'count', type: ABIDataTypes.UINT256 },
        ],
    },
    {
        type: BitcoinAbiTypes.Function,
        name: 'getOwnerView',
        inputs: [],
        outputs: [
            { name: 'owner', type: ABIDataTypes.UINT256 },
        ],
    },
    {
        type: BitcoinAbiTypes.Function,
        name: 'getCallerAddressView',
        inputs: [],
        outputs: [
            { name: 'callerAddress', type: ABIDataTypes.UINT256 },
        ],
    },
];
