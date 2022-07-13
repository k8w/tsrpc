/**
 * API service request and response type, and Msg service type.
 * For coding auto hint.
 */
export interface BaseServiceType {
    /** Send a request, and wait for a response */
    api: {
        [apiName: string]: {
            /** Request type */
            req: any,
            /** Response type */
            res: any
        }
    },
    /** Msg service, listen or send one-way msg without response  */
    msg: {
        /** Msg type */
        [msgName: string]: any
    };
}
