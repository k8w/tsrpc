import { OpResultVoid } from 'tsrpc-base';

export type WebSocketConnect = (
  options: WebSocketConnectOptions
) => WebSocketConnectReturn;

export interface WebSocketConnectOptions {
  server: string;
  protocols: string[];
  onOpen: () => void;
  onClose: (code?: number, reason?: string) => void;
  onError: (e: Error) => void;
  onMessage: (data: Uint8Array | string) => void;
}

export interface WebSocketConnectReturn {
  close(reason: string, code: number): void;
  send(data: Uint8Array | string): Promise<OpResultVoid>;
}
