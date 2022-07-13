export interface TSAPI {
    version: string,
    servers: string[],
    apis: {
        path: string,
        title?: string,
        remark?: string,
        req: {
            ts: string
        },
        res: {
            ts: string
        },
        conf?: any
    }[],
    // schemas: {
    //     [schemaId: string]: {
    //         ts: string
    //     }
    // }
}