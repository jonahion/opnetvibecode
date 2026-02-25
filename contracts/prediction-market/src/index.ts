import { Blockchain } from '@btc-vision/btc-runtime/runtime';
import { PredictionMarket } from './PredictionMarket';

Blockchain.contract = (): PredictionMarket => {
    return new PredictionMarket();
};

export function abort(message: string | null, _fileName: string | null, line: u32, column: u32): void {
    const msg = message ? message : 'unknown error';
    trace('ABORT: ' + msg + ' at line ' + line.toString() + ':' + column.toString());
}
