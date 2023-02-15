import http from 'http';
import {
  BaseServiceType,
  OpResultVoid,
  TransportData,
  TransportOptions,
} from 'tsrpc-base';
import { BaseServerConnection } from 'tsrpc-base-server';
import WebSocket from 'ws';
import { HttpUtil } from '../http/models/HttpUtil';
import { WebSocketServer } from './WebSocketServer';

export class WebSocketServerConnection<
  ServiceType extends BaseServiceType = any
> extends BaseServerConnection<ServiceType> {
  readonly ws: WebSocket;
  readonly httpReq: http.IncomingMessage;

  constructor(
    public readonly server: WebSocketServer<ServiceType>,
    privateOptions: PrivateWebSocketServerConnectionOptions
  ) {
    const ip = HttpUtil.getClientIp(privateOptions.httpReq);
    const protocols = privateOptions.httpReq.headers['sec-websocket-protocol']
      ?.split(',')
      .map((v) => v.trim())
      .filter((v) => !!v);
    super(server, {
      dataType: protocols?.includes('buffer') ? 'buffer' : 'text',
      ip: ip,
    });

    this.ws = privateOptions.ws;
    this.httpReq = privateOptions.httpReq;

    // Init ws
    this.ws.onclose = async (e) => {
      if (this._rsDoDisconnect) {
        this._rsDoDisconnect({ isSucc: true });
      } else {
        this._disconnect(false, e.reason);
      }
    };
    this.ws.onerror = (e) => {
      this.logger.error('[WsError]', e.error);
    };
    this.ws.onmessage = (e) => {
      let data: Buffer | string;
      if (e.data instanceof ArrayBuffer) {
        data = Buffer.from(e.data);
      } else if (Array.isArray(e.data)) {
        data = Buffer.concat(e.data);
      } else if (Buffer.isBuffer(e.data)) {
        data = e.data;
      } else {
        data = e.data;
      }
      this._recvData(data);
    };

    this._doConnect();
  }

  protected _rsDoDisconnect?: (res: OpResultVoid) => void;
  protected _doDisconnect(
    isManual: boolean,
    reason?: string | undefined
  ): Promise<OpResultVoid> {
    return new Promise<OpResultVoid>((rs) => {
      this.ws.close(isManual ? 1000 : 1001, reason ?? '');
      this._rsDoDisconnect = rs;
    })
      .catch((e: Error) => ({ isSucc: false, errMsg: e.message }))
      .then((v) => {
        this._rsDoDisconnect = undefined;
        return v;
      });
  }

  protected _sendData(
    data: string | Uint8Array,
    transportData: TransportData,
    options?: TransportOptions
  ): Promise<OpResultVoid> {
    return new Promise((rs) => {
      this.ws.send(data, (e) => {
        e
          ? rs({
              isSucc: false,
              errMsg: e.message || 'Unknown error when sendData',
            })
          : rs({ isSucc: true });
      });
    });
  }
}

export interface PrivateWebSocketServerConnectionOptions {
  ws: WebSocket;
  httpReq: http.IncomingMessage;
}
