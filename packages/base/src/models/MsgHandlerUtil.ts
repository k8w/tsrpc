import { BaseConnection, MsgHandler } from '../base/BaseConnection';
import { ServiceMap } from './ServiceMapUtil';

export class MsgHandlerUtil {
  /**
   * Add a message handler,
   * duplicate handlers to the same `msgName` would be ignored.
   * @param msgName
   * @param handler
   * @returns
   */
  static onMsg<T extends MsgHandler>(
    host: MsgHandlerHost,
    msgHandlers: BaseConnection['_msgHandlers'],
    msgName: string | RegExp,
    handler: T,
    context?: any
  ): T {
    if (msgName instanceof RegExp) {
      Object.keys(host.serviceMap.name2Msg)
        .filter((k) => msgName.test(k))
        .forEach((k) => {
          msgHandlers.on(k, handler, context);
        });
      return handler;
    } else {
      return msgHandlers.on(msgName, handler, context);
    }
  }

  static onceMsg<T extends MsgHandler>(
    msgHandlers: BaseConnection['_msgHandlers'],
    msgName: string,
    handler: T,
    context?: any
  ): T {
    return msgHandlers.once(msgName, handler, context);
  }

  /**
   * Remove a message handler
   */
  static offMsg(
    host: MsgHandlerHost,
    msgHandlers: BaseConnection['_msgHandlers'],
    msgName: string | RegExp,
    handler?: MsgHandler,
    context?: any
  ) {
    if (msgName instanceof RegExp) {
      Object.keys(host.serviceMap.name2Msg)
        .filter((k) => msgName.test(k))
        .forEach((k) => {
          handler ? msgHandlers.off(k, handler, context) : msgHandlers.off(k);
        });
    } else {
      handler
        ? msgHandlers.off(msgName, handler, context)
        : msgHandlers.off(msgName);
    }
  }
}

export type MsgHandlerHost = Pick<BaseConnection, 'serviceMap'>;