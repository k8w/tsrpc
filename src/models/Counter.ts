export class Counter {

    private _min: number;
    private _max: number;
    private _last: number;

    constructor(min: number = 1, max: number = Number.MAX_SAFE_INTEGER) {
        this._min = min;
        this._max = max;
        this._last = max;
    }

    /** 复位：从新从0开始计数 */
    reset() {
        this._last = this._max;
    }

    getNext() {
        return this._last >= this._max ? (this._last = this._min) : ++this._last;
    }

    get last() {
        return this._last;
    }
}