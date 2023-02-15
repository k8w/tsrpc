export class EventEmitter<EventType extends Record<string, any[]> = any> {
  private _listeners: {
    [type: string]: {
      listener: Function;
      once?: boolean;
      context?: any;
    }[];
  } = {};

  private _getListeners(type: string): EventEmitter<any>['_listeners'][string] {
    if (!this._listeners[type]) {
      this._listeners[type] = [];
    }
    return this._listeners[type];
  }

  private _addListener(
    type: string,
    value: EventEmitter<any>['_listeners'][string][0]
  ) {
    const listeners = this._getListeners(type);
    if (
      !listeners.some(
        (v) => v.listener === value.listener && v.context === value.context
      )
    ) {
      listeners.push(value);
    }
  }

  on<
    T extends string & keyof EventType,
    U extends (...params: EventType[T]) => any
  >(type: T, listener: U, context?: any): U {
    this._addListener(type, { listener, context });
    return listener;
  }

  once<
    T extends string & keyof EventType,
    U extends (...params: EventType[T]) => any
  >(type: T, listener: U, context?: any): U {
    this._addListener(type, { listener, context, once: true });
    return listener;
  }

  /** Off all */
  off<T extends string & keyof EventType>(type: T): void;
  /** Off one */
  off<T extends string & keyof EventType>(
    type: T,
    listener: Function,
    context?: any
  ): void;
  off<T extends string & keyof EventType>(
    type: T,
    listener?: Function,
    context?: any
  ) {
    // Off all
    if (!listener) {
      this._listeners[type] = undefined!;
      return;
    }

    // Off one
    const listeners = this._getListeners(type);
    listeners.removeOne(
      (v) => v.listener === listener && v.context === context
    );
  }

  emit<T extends string & keyof EventType>(type: T, ...event: EventType[T]) {
    const listeners = this._getListeners(type);
    for (let i = 0; i < listeners.length; ++i) {
      const item = listeners[i];

      // Not throw error
      try {
        item.listener.call(item.context, ...event);
      } catch (e) {
        console.error(e);
      }

      if (item.once) {
        listeners.splice(i, 1);
        --i;
      }
    }
  }
}
