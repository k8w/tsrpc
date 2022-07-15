export class BaseConnection {

    flows: {
        // Conn Flows
        /** After the connection is created */
        postConnectFlow: new Flow<BaseConnection<ServiceType>>(),
        /** After the connection is disconnected */
        postDisconnectFlow: new Flow<{ conn: BaseConnection<ServiceType>, reason?: string }>(),

        // Buffer Flows
        /**
         * Before processing the received data, usually be used to encryption / decryption.
         * Return `null | undefined` would ignore the buffer.
         */
        preRecvDataFlow: new Flow<{
            conn: BaseConnection<ServiceType>,
            data: string | Uint8Array | object,
            /**
             * @deprecated use `serviceId` instead
             */
            serviceName?: string,
            /** 
             * Parsed service id, you can get this by `this.serviceMap.apiName2Service[serviceName].id`
             */
            serviceId?: number
        }>(),
        /**
         * Before send out data to network, usually be used to encryption / decryption.
         * Return `null | undefined` would not send the buffer.
         */
        preSendDataFlow: new Flow<{ conn: BaseConnection<ServiceType>, data: string | Uint8Array | object, call?: ApiCall }>(),
        /**
         * @deprecated Use `preRecvDataFlow` instead.
         */
        preRecvBufferFlow: new Flow<{ conn: BaseConnection<ServiceType>, buf: Uint8Array }>(),
        /**
         * @deprecated Use `preSendDataFlow` instead.
         */
        preSendBufferFlow: new Flow<{ conn: BaseConnection<ServiceType>, buf: Uint8Array, call?: ApiCall }>(),

        // ApiCall Flows
        /**
         * Before a API request is send.
         * Return `null | undefined` would cancel the request.
         */
        preApiCallFlow: new Flow<ApiCall>(),
        /**
         * Before return the `ApiReturn` to the client.
         * It may be used to change the return value, or return `null | undefined` to abort the request.
         */
        preApiReturnFlow: new Flow<{ call: ApiCall, return: ApiReturn<any> }>(),
        /** 
         * After the `ApiReturn` is send.
         * return `null | undefined` would NOT interrupt latter behaviours.
         */
        postApiReturnFlow: new Flow<{ call: ApiCall, return: ApiReturn<any> }>(),
        /**
         * After the api handler is executed.
         * return `null | undefined` would NOT interrupt latter behaviours.
         */
        postApiCallFlow: new Flow<ApiCall>(),

        // MsgCall Flows
        /**
         * Before handle a `MsgCall`
         */
        preMsgCallFlow: new Flow<MsgCall>(),
        /**
         * After handlers of a `MsgCall` are executed.
         * return `null | undefined` would NOT interrupt latter behaviours.
         */
        postMsgCallFlow: new Flow<MsgCall>(),
        /**
         * Before send out a message.
         * return `null | undefined` would NOT interrupt latter behaviours.
         */
        preSendMsgFlow: new Flow<{ conn: BaseConnection<ServiceType>, service: MsgService, msg: any }>(),
        /**
         * After send out a message.
         * return `null | undefined` would NOT interrupt latter behaviours.
         */
        postSendMsgFlow: new Flow<{ conn: BaseConnection<ServiceType>, service: MsgService, msg: any }>(),
    };

    // API
    callApi() { }
    implementApi() { }

    // Message
    sendMsg() { }
    listenMsg() { }

    // Data
    protected _sendData() { }
    protected _recvData() { }

}