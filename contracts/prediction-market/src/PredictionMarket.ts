import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Address,
    Blockchain,
    BytesWriter,
    Calldata,
    encodeSelector,
    NetEvent,
    OP_NET,
    Revert,
    SafeMath,
    Selector,
    StoredU256,
    StoredU64,
    AddressMemoryMap,
    StoredMapU256,
    EMPTY_POINTER,
} from '@btc-vision/btc-runtime/runtime';

const OUTCOME_YES: u256 = u256.One;
const OUTCOME_NO: u256 = u256.fromU32(2);
const STATUS_OPEN: u256 = u256.One;
const STATUS_RESOLVED: u256 = u256.fromU32(2);
const MAX_MARKETS: u256 = u256.fromU32(10000);

function encodeMarketCreatedEvent(marketId: u256, creator: Address, endBlock: u64): BytesWriter {
    const writer: BytesWriter = new BytesWriter(72);
    writer.writeU256(marketId);
    writer.writeAddress(creator);
    writer.writeU64(endBlock);
    return writer;
}

function encodeBetPlacedEvent(marketId: u256, bettor: Address, outcome: u256, amount: u256): BytesWriter {
    const writer: BytesWriter = new BytesWriter(128);
    writer.writeU256(marketId);
    writer.writeAddress(bettor);
    writer.writeU256(outcome);
    writer.writeU256(amount);
    return writer;
}

function encodeMarketResolvedEvent(marketId: u256, outcome: u256): BytesWriter {
    const writer: BytesWriter = new BytesWriter(64);
    writer.writeU256(marketId);
    writer.writeU256(outcome);
    return writer;
}

function encodeWingsClaimedEvent(marketId: u256, claimant: Address, amount: u256): BytesWriter {
    const writer: BytesWriter = new BytesWriter(96);
    writer.writeU256(marketId);
    writer.writeAddress(claimant);
    writer.writeU256(amount);
    return writer;
}

class MarketCreated extends NetEvent {
    public constructor(marketId: u256, creator: Address, endBlock: u64) {
        super('MarketCreated', encodeMarketCreatedEvent(marketId, creator, endBlock));
    }
}

class BetPlaced extends NetEvent {
    public constructor(marketId: u256, bettor: Address, outcome: u256, amount: u256) {
        super('BetPlaced', encodeBetPlacedEvent(marketId, bettor, outcome, amount));
    }
}

class MarketResolved extends NetEvent {
    public constructor(marketId: u256, outcome: u256) {
        super('MarketResolved', encodeMarketResolvedEvent(marketId, outcome));
    }
}

class WinningsClaimed extends NetEvent {
    public constructor(marketId: u256, claimant: Address, amount: u256) {
        super('WinningsClaimed', encodeWingsClaimedEvent(marketId, claimant, amount));
    }
}

@final
export class PredictionMarket extends OP_NET {
    private readonly createMarketSelector: Selector = encodeSelector('createMarket(string,uint64,address)');
    private readonly placeBetSelector: Selector = encodeSelector('placeBet(uint256,uint256,uint256)');
    private readonly resolveMarketSelector: Selector = encodeSelector('resolveMarket(uint256,uint256)');
    private readonly claimWinningsSelector: Selector = encodeSelector('claimWinnings(uint256)');
    private readonly getMarketSelector: Selector = encodeSelector('getMarket(uint256)');
    private readonly getUserPositionSelector: Selector = encodeSelector('getUserPosition(uint256,address)');
    private readonly getMarketCountSelector: Selector = encodeSelector('getMarketCount()');
    private readonly getOwnerSelector: Selector = encodeSelector('getOwner()');

    // Global storage
    private readonly marketCountPointer: u16 = Blockchain.nextPointer;
    private readonly ownerPointer: u16 = Blockchain.nextPointer;
    private readonly _marketCount: StoredU256 = new StoredU256(this.marketCountPointer, EMPTY_POINTER);
    private readonly _ownerAddress: StoredU256 = new StoredU256(this.ownerPointer, EMPTY_POINTER);

    // Per-market storage base pointers
    private readonly marketCreatorPointer: u16 = Blockchain.nextPointer;
    private readonly marketEndBlockPointer: u16 = Blockchain.nextPointer;
    private readonly marketOraclePointer: u16 = Blockchain.nextPointer;
    private readonly marketStatusPointer: u16 = Blockchain.nextPointer;
    private readonly marketOutcomePointer: u16 = Blockchain.nextPointer;
    private readonly marketYesPoolPointer: u16 = Blockchain.nextPointer;
    private readonly marketNoPoolPointer: u16 = Blockchain.nextPointer;

    // User bets per market
    private readonly userYesBetsPointer: u16 = Blockchain.nextPointer;
    private readonly userNoBetsPointer: u16 = Blockchain.nextPointer;
    private readonly userClaimedPointer: u16 = Blockchain.nextPointer;

    public constructor() {
        super();
    }

    public override onDeployment(_calldata: Calldata): void {
        const deployer: Address = Blockchain.tx.sender;
        this._ownerAddress.value = u256.fromUint8ArrayBE(deployer);
    }

    public callMethod(calldata: Calldata): BytesWriter {
        const selector: Selector = calldata.readSelector();

        switch (selector) {
            case this.createMarketSelector:
                return this.createMarket(calldata);
            case this.placeBetSelector:
                return this.placeBet(calldata);
            case this.resolveMarketSelector:
                return this.resolveMarket(calldata);
            case this.claimWinningsSelector:
                return this.claimWinnings(calldata);
            case this.getMarketSelector:
                return this.getMarket(calldata);
            case this.getUserPositionSelector:
                return this.getUserPosition(calldata);
            case this.getMarketCountSelector:
                return this.getMarketCountView();
            case this.getOwnerSelector:
                return this.getOwnerView();
            default:
                return super.callMethod(calldata);
        }
    }

    @method(
        { name: 'question', type: ABIDataTypes.STRING },
        { name: 'endBlock', type: ABIDataTypes.UINT64 },
        { name: 'oracle', type: ABIDataTypes.ADDRESS },
    )
    @returns({ name: 'marketId', type: ABIDataTypes.UINT256 })
    @emit('MarketCreated')
    public createMarket(calldata: Calldata): BytesWriter {
        const question: string = calldata.readStringWithLength();
        const endBlock: u64 = calldata.readU64();
        const oracle: Address = calldata.readAddress();

        if (endBlock <= Blockchain.block.number) {
            throw new Revert('End block must be in the future');
        }

        if (question.length == 0) {
            throw new Revert('Question must not be empty');
        }

        const currentCount: u256 = this._marketCount.value;
        if (currentCount >= MAX_MARKETS) {
            throw new Revert('Maximum markets reached');
        }

        const marketId: u256 = SafeMath.add(currentCount, u256.One);
        this._marketCount.value = marketId;

        const creator: Address = Blockchain.tx.sender;
        const marketIdBytes: Uint8Array = this.toSubPointer(marketId);

        this.getMarketStore(this.marketCreatorPointer, marketIdBytes).value = u256.fromUint8ArrayBE(creator);
        this.setMarketEndBlock(marketIdBytes, endBlock);
        this.getMarketStore(this.marketOraclePointer, marketIdBytes).value = u256.fromUint8ArrayBE(oracle);
        this.getMarketStore(this.marketStatusPointer, marketIdBytes).value = STATUS_OPEN;
        this.getMarketStore(this.marketOutcomePointer, marketIdBytes).value = u256.Zero;
        this.getMarketStore(this.marketYesPoolPointer, marketIdBytes).value = u256.Zero;
        this.getMarketStore(this.marketNoPoolPointer, marketIdBytes).value = u256.Zero;

        this.emitEvent(new MarketCreated(marketId, creator, endBlock));

        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(marketId);
        return writer;
    }

    @method(
        { name: 'marketId', type: ABIDataTypes.UINT256 },
        { name: 'outcome', type: ABIDataTypes.UINT256 },
        { name: 'amount', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    @emit('BetPlaced')
    public placeBet(calldata: Calldata): BytesWriter {
        const marketId: u256 = calldata.readU256();
        const outcome: u256 = calldata.readU256();
        const amount: u256 = calldata.readU256();

        if (!u256.eq(outcome, OUTCOME_YES) && !u256.eq(outcome, OUTCOME_NO)) {
            throw new Revert('Invalid outcome: must be 1 (YES) or 2 (NO)');
        }

        const marketIdBytes: Uint8Array = this.toSubPointer(marketId);

        const status: u256 = this.getMarketStore(this.marketStatusPointer, marketIdBytes).value;
        if (!u256.eq(status, STATUS_OPEN)) {
            throw new Revert('Market is not open');
        }

        const endBlock: u64 = this.getMarketEndBlock(marketIdBytes);
        if (Blockchain.block.number >= endBlock) {
            throw new Revert('Market betting period has ended');
        }

        if (u256.eq(amount, u256.Zero)) {
            throw new Revert('Amount must be greater than zero');
        }

        const bettor: Address = Blockchain.tx.sender;

        if (u256.eq(outcome, OUTCOME_YES)) {
            const poolStore: StoredU256 = this.getMarketStore(this.marketYesPoolPointer, marketIdBytes);
            poolStore.value = SafeMath.add(poolStore.value, amount);

            this.addUserBet(this.userYesBetsPointer, marketIdBytes, bettor, amount);
        } else {
            const poolStore: StoredU256 = this.getMarketStore(this.marketNoPoolPointer, marketIdBytes);
            poolStore.value = SafeMath.add(poolStore.value, amount);

            this.addUserBet(this.userNoBetsPointer, marketIdBytes, bettor, amount);
        }

        this.emitEvent(new BetPlaced(marketId, bettor, outcome, amount));

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    @method(
        { name: 'marketId', type: ABIDataTypes.UINT256 },
        { name: 'outcome', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    @emit('MarketResolved')
    public resolveMarket(calldata: Calldata): BytesWriter {
        const marketId: u256 = calldata.readU256();
        const outcome: u256 = calldata.readU256();

        if (!u256.eq(outcome, OUTCOME_YES) && !u256.eq(outcome, OUTCOME_NO)) {
            throw new Revert('Invalid outcome: must be 1 (YES) or 2 (NO)');
        }

        const marketIdBytes: Uint8Array = this.toSubPointer(marketId);

        const status: u256 = this.getMarketStore(this.marketStatusPointer, marketIdBytes).value;
        if (!u256.eq(status, STATUS_OPEN)) {
            throw new Revert('Market is not open');
        }

        const oracleU256: u256 = this.getMarketStore(this.marketOraclePointer, marketIdBytes).value;
        const caller: Address = Blockchain.tx.sender;
        if (!u256.eq(u256.fromUint8ArrayBE(caller), oracleU256)) {
            throw new Revert('Only the designated oracle can resolve');
        }

        const endBlock: u64 = this.getMarketEndBlock(marketIdBytes);
        if (Blockchain.block.number < endBlock) {
            throw new Revert('Market betting period has not ended yet');
        }

        this.getMarketStore(this.marketStatusPointer, marketIdBytes).value = STATUS_RESOLVED;
        this.getMarketStore(this.marketOutcomePointer, marketIdBytes).value = outcome;

        this.emitEvent(new MarketResolved(marketId, outcome));

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    @method({ name: 'marketId', type: ABIDataTypes.UINT256 })
    @returns({ name: 'amount', type: ABIDataTypes.UINT256 })
    @emit('WinningsClaimed')
    public claimWinnings(calldata: Calldata): BytesWriter {
        const marketId: u256 = calldata.readU256();
        const marketIdBytes: Uint8Array = this.toSubPointer(marketId);

        const status: u256 = this.getMarketStore(this.marketStatusPointer, marketIdBytes).value;
        if (!u256.eq(status, STATUS_RESOLVED)) {
            throw new Revert('Market is not resolved yet');
        }

        const claimant: Address = Blockchain.tx.sender;
        const claimedVal: u256 = this.getUserBet(this.userClaimedPointer, marketIdBytes, claimant);
        if (!u256.eq(claimedVal, u256.Zero)) {
            throw new Revert('Already claimed');
        }

        const winningOutcome: u256 = this.getMarketStore(this.marketOutcomePointer, marketIdBytes).value;

        let userBet: u256;
        let winningPool: u256;
        let losingPool: u256;

        if (u256.eq(winningOutcome, OUTCOME_YES)) {
            userBet = this.getUserBet(this.userYesBetsPointer, marketIdBytes, claimant);
            winningPool = this.getMarketStore(this.marketYesPoolPointer, marketIdBytes).value;
            losingPool = this.getMarketStore(this.marketNoPoolPointer, marketIdBytes).value;
        } else {
            userBet = this.getUserBet(this.userNoBetsPointer, marketIdBytes, claimant);
            winningPool = this.getMarketStore(this.marketNoPoolPointer, marketIdBytes).value;
            losingPool = this.getMarketStore(this.marketYesPoolPointer, marketIdBytes).value;
        }

        if (u256.eq(userBet, u256.Zero)) {
            throw new Revert('No winning bet found');
        }

        const totalPool: u256 = SafeMath.add(winningPool, losingPool);
        const payout: u256 = SafeMath.div(SafeMath.mul(userBet, totalPool), winningPool);

        this.setUserBet(this.userClaimedPointer, marketIdBytes, claimant, u256.One);

        this.emitEvent(new WinningsClaimed(marketId, claimant, payout));

        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(payout);
        return writer;
    }

    @method({ name: 'marketId', type: ABIDataTypes.UINT256 })
    @returns(
        { name: 'creator', type: ABIDataTypes.UINT256 },
        { name: 'endBlock', type: ABIDataTypes.UINT64 },
        { name: 'oracle', type: ABIDataTypes.UINT256 },
        { name: 'status', type: ABIDataTypes.UINT256 },
        { name: 'outcome', type: ABIDataTypes.UINT256 },
        { name: 'yesPool', type: ABIDataTypes.UINT256 },
        { name: 'noPool', type: ABIDataTypes.UINT256 },
    )
    public getMarket(calldata: Calldata): BytesWriter {
        const marketId: u256 = calldata.readU256();
        const marketIdBytes: Uint8Array = this.toSubPointer(marketId);

        const creator: u256 = this.getMarketStore(this.marketCreatorPointer, marketIdBytes).value;
        const endBlock: u64 = this.getMarketEndBlock(marketIdBytes);
        const oracle: u256 = this.getMarketStore(this.marketOraclePointer, marketIdBytes).value;
        const status: u256 = this.getMarketStore(this.marketStatusPointer, marketIdBytes).value;
        const outcome: u256 = this.getMarketStore(this.marketOutcomePointer, marketIdBytes).value;
        const yesPool: u256 = this.getMarketStore(this.marketYesPoolPointer, marketIdBytes).value;
        const noPool: u256 = this.getMarketStore(this.marketNoPoolPointer, marketIdBytes).value;

        const writer: BytesWriter = new BytesWriter(232);
        writer.writeU256(creator);
        writer.writeU64(endBlock);
        writer.writeU256(oracle);
        writer.writeU256(status);
        writer.writeU256(outcome);
        writer.writeU256(yesPool);
        writer.writeU256(noPool);
        return writer;
    }

    @method(
        { name: 'marketId', type: ABIDataTypes.UINT256 },
        { name: 'user', type: ABIDataTypes.ADDRESS },
    )
    @returns(
        { name: 'yesBet', type: ABIDataTypes.UINT256 },
        { name: 'noBet', type: ABIDataTypes.UINT256 },
        { name: 'claimed', type: ABIDataTypes.BOOL },
    )
    public getUserPosition(calldata: Calldata): BytesWriter {
        const marketId: u256 = calldata.readU256();
        const user: Address = calldata.readAddress();
        const marketIdBytes: Uint8Array = this.toSubPointer(marketId);

        const yesBet: u256 = this.getUserBet(this.userYesBetsPointer, marketIdBytes, user);
        const noBet: u256 = this.getUserBet(this.userNoBetsPointer, marketIdBytes, user);
        const claimed: u256 = this.getUserBet(this.userClaimedPointer, marketIdBytes, user);

        const writer: BytesWriter = new BytesWriter(65);
        writer.writeU256(yesBet);
        writer.writeU256(noBet);
        writer.writeBoolean(!u256.eq(claimed, u256.Zero));
        return writer;
    }

    @method()
    @returns({ name: 'count', type: ABIDataTypes.UINT256 })
    public getMarketCountView(_calldata: Calldata): BytesWriter {
        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(this._marketCount.value);
        return writer;
    }

    @method()
    @returns({ name: 'owner', type: ABIDataTypes.UINT256 })
    public getOwnerView(_calldata: Calldata): BytesWriter {
        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(this._ownerAddress.value);
        return writer;
    }

    private toSubPointer(marketId: u256): Uint8Array {
        const full: Uint8Array = marketId.toUint8Array(true);
        const sub: Uint8Array = new Uint8Array(30);
        for (let i: i32 = 0; i < 30; i++) {
            sub[i] = full[i + 2];
        }
        return sub;
    }

    private getMarketStore(basePointer: u16, subPointer: Uint8Array): StoredU256 {
        return new StoredU256(basePointer, subPointer);
    }

    private getMarketEndBlock(subPointer: Uint8Array): u64 {
        const stored: StoredU64 = new StoredU64(this.marketEndBlockPointer, subPointer);
        return stored.get(0);
    }

    private setMarketEndBlock(subPointer: Uint8Array, endBlock: u64): void {
        const stored: StoredU64 = new StoredU64(this.marketEndBlockPointer, subPointer);
        stored.set(0, endBlock);
        stored.save();
    }

    private getUserBet(basePointer: u16, subPointer: Uint8Array, user: Address): u256 {
        const map: StoredMapU256 = new StoredMapU256(basePointer, subPointer);
        return map.get(u256.fromUint8ArrayBE(user));
    }

    private setUserBet(basePointer: u16, subPointer: Uint8Array, user: Address, val: u256): void {
        const map: StoredMapU256 = new StoredMapU256(basePointer, subPointer);
        map.set(u256.fromUint8ArrayBE(user), val);
    }

    private addUserBet(basePointer: u16, subPointer: Uint8Array, user: Address, amount: u256): void {
        const current: u256 = this.getUserBet(basePointer, subPointer, user);
        this.setUserBet(basePointer, subPointer, user, SafeMath.add(current, amount));
    }
}
