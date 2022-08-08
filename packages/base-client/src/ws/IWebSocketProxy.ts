export interface IWebSocketProxy {
    connect(): void;
    onConnect?: any;
    onMessage?: any;
    // ...
}