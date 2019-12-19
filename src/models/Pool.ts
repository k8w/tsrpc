export class Pool<ItemClass extends PoolItem<any>> {

    private _pools: ItemClass[] = [];
    private _itemClass: { new(): ItemClass };
    enabled: boolean;

    constructor(itemClass: { new(): ItemClass }, enabled: boolean) {
        this._itemClass = itemClass;
        this.enabled = enabled;
    }

    get(options: ItemClass['options']) {
        let item = this.enabled && this._pools.pop();
        if (!item) {
            item = new this._itemClass();
        }
        item.reset(options);
        return item;
    }

    put(item: ItemClass) {
        if (!this.enabled || this._pools.indexOf(item) > -1) {
            return;
        }

        item.clean();
        this._pools.push(item);
    }

}

export class PoolItem<Options> {
    protected _options?: Options;
    public get options(): Options {
        if (!this._options) {
            throw new Error('Cannot use a recycled pool item');
        }
        return this._options;
    }
    public set options(v: Options) {
        this._options = v;
    }

    reset(options: Options) {
        this._options = options;
    }

    clean() {
        this._options = undefined as any;
    }
}