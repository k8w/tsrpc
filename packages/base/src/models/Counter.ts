/**
 * An auto-increment counter
 */
export class Counter {

    private _min: number;
    private _max: number;
    private _last: number;

    constructor(min: number = 1, max: number = Number.MAX_SAFE_INTEGER) {
        this._min = min;
        this._max = max;
        this._last = max;
    }

    /**
     * Reset the counter, makes `getNext()` restart from `0`
     */
    reset() {
        this._last = this._max;
    }

    /**
     * Get next counter value, and auto increment `1`
     * @param notInc - Just get the next possible value, not actually increasing the sequence
     */
    getNext(notInc?: boolean) {
        return this._last >= this._max ? (this._last = this._min) : (notInc ? this._last : ++this._last);
    }

    /**
     * Last return of `getNext()`
     */
    get last() {
        return this._last;
    }
}