export class Pool<ItemClass extends PoolItem> {
  private _pools: ItemClass[] = []
  private _itemClass: { new (): ItemClass }
  enabled: boolean

  constructor(itemClass: { new (): ItemClass }, enabled: boolean) {
    this._itemClass = itemClass
    this.enabled = enabled
  }

  get() {
    let item = this.enabled && this._pools.pop()
    if (!item) {
      item = new this._itemClass()
    }
    item.reuse?.()
    return item
  }

  put(item: ItemClass) {
    if (!this.enabled || this._pools.indexOf(item) > -1) {
      return
    }

    item.unuse?.()
    this._pools.push(item)
  }
}

export interface PoolItem {
  reuse: () => void
  unuse: () => void
}
