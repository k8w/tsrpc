export class Pool<ItemClass extends PoolItem<any>> {

    private _pools: ItemClass[] = [];
    private _itemClass: { new(): ItemClass };

    constructor(itemClass: { new(): ItemClass }) {
        this._itemClass = itemClass;
    }

    get(options: ItemClass['options']) {
        let item = this._pools.pop();
        if (!item) {
            item = new this._itemClass();
        }
        item.reset(options);
        return item;
    }

    put(item: ItemClass) {
        if (this._pools.indexOf(item) > -1) {
            return;
        }

        item.clean();
        this._pools.push(item);
    }

}

export class PoolItem<Options> {
    options!: Options;
    reset(options: Options) {
        this.options = options;
    }

    clean() {
        this.options = undefined as any;
    }

}