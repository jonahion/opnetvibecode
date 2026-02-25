export interface MarketData {
    id: bigint;
    creator: string;
    endBlock: bigint;
    oracle: string;
    status: MarketStatus;
    outcome: MarketOutcome;
    yesPool: bigint;
    noPool: bigint;
    question: string;
}

export enum MarketStatus {
    UNKNOWN = 0,
    OPEN = 1,
    RESOLVED = 2,
}

export enum MarketOutcome {
    NONE = 0,
    YES = 1,
    NO = 2,
}

export interface UserPosition {
    yesBet: bigint;
    noBet: bigint;
    claimed: boolean;
}

export interface CreateMarketParams {
    question: string;
    endBlock: bigint;
    oracleAddress: string;
}
