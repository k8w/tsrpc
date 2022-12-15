import { OpResultVoid } from "tsrpc-base";

export interface BaseWsClientTransport {
    connect(options: ConnectOptions): SocketInstance;
}

export interface ConnectOptions {
    server: string,
    protocols: string[],
    onOpen: () => void,
    onClose: (code?: number, reason?: string) => void,
    onError: (e: Error) => void,
    onMessage: (data: Uint8Array | string) => void,
}

export interface SocketInstance {
    close(reason: string, code: number): void;
    send(data: Uint8Array | string): Promise<OpResultVoid>;
}