export interface ApiDocData {
    servers: string[],
    apis: {
        apiName: string,
        desc: string,
        reqType: string,
        resType: string
    }[]
}