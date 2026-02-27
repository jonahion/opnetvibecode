import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------
export type MarketCreatedEvent = {
    readonly marketId: bigint;
    readonly creator: Address;
    readonly endBlock: bigint;
};
export type BetPlacedEvent = {
    readonly marketId: bigint;
    readonly bettor: Address;
    readonly outcome: bigint;
    readonly amount: bigint;
};
export type MarketResolvedEvent = {
    readonly marketId: bigint;
    readonly outcome: bigint;
};
export type WinningsClaimedEvent = {
    readonly marketId: bigint;
    readonly claimant: Address;
    readonly amount: bigint;
};

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the createMarket function call.
 */
export type CreateMarket = CallResult<
    {
        marketId: bigint;
    },
    OPNetEvent<MarketCreatedEvent>[]
>;

/**
 * @description Represents the result of the placeBet function call.
 */
export type PlaceBet = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<BetPlacedEvent>[]
>;

/**
 * @description Represents the result of the resolveMarket function call.
 */
export type ResolveMarket = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<MarketResolvedEvent>[]
>;

/**
 * @description Represents the result of the claimWinnings function call.
 */
export type ClaimWinnings = CallResult<
    {
        amount: bigint;
    },
    OPNetEvent<WinningsClaimedEvent>[]
>;

/**
 * @description Represents the result of the getMarket function call.
 */
export type GetMarket = CallResult<
    {
        creator: bigint;
        endBlock: bigint;
        oracle: bigint;
        status: bigint;
        outcome: bigint;
        yesPool: bigint;
        noPool: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getUserPosition function call.
 */
export type GetUserPosition = CallResult<
    {
        yesBet: bigint;
        noBet: bigint;
        claimed: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getMarketCountView function call.
 */
export type GetMarketCountView = CallResult<
    {
        count: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getOwnerView function call.
 */
export type GetOwnerView = CallResult<
    {
        owner: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getCallerAddressView function call.
 */
export type GetCallerAddressView = CallResult<
    {
        callerAddress: bigint;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// IPredictionMarket
// ------------------------------------------------------------------
export interface IPredictionMarket extends IOP_NETContract {
    createMarket(question: string, endBlock: bigint, oracle: Address): Promise<CreateMarket>;
    placeBet(marketId: bigint, outcome: bigint, amount: bigint): Promise<PlaceBet>;
    resolveMarket(marketId: bigint, outcome: bigint): Promise<ResolveMarket>;
    claimWinnings(marketId: bigint): Promise<ClaimWinnings>;
    getMarket(marketId: bigint): Promise<GetMarket>;
    getUserPosition(marketId: bigint, user: Address): Promise<GetUserPosition>;
    getMarketCountView(): Promise<GetMarketCountView>;
    getOwnerView(): Promise<GetOwnerView>;
    getCallerAddressView(): Promise<GetCallerAddressView>;
}
