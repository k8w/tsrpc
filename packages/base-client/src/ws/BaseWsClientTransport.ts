import { Logger } from "../../models/Logger";
import { OpResult } from "../../models/OpResult";

export interface BaseWsClientTransport {
    onOpen: () => void;
    onClose: (code?: number, reason?: string) => void;
    onError: (e: unknown) => void;
    onMessage: (data: Uint8Array | string) => void;
    logger: Logger | undefined;

    // Create and connect (return ws client)
    connect(server: string, protocols?: string[]): void;
    close(reason: string, code: number): void;
    send(data: Uint8Array | string): Promise<OpResult<void>>;
}