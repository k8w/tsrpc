import { ServiceProto } from 'tsrpc-proto';
import { ReqTest, ResTest } from './a/b/c/PtlTest'
import { MsgChat } from './MsgChat'
import { ReqTest as ReqTest_1, ResTest as ResTest_1 } from './PtlTest'

export interface ServiceType {
    api: {
        "a/b/c/Test": {
            req: ReqTest,
            res: ResTest
        },
        "Test": {
            req: ReqTest_1,
            res: ResTest_1
        }
    },
    msg: {
        "Chat": MsgChat
    }
}

export const serviceProto: ServiceProto<ServiceType> = {
    "services": [
        {
            "id": 0,
            "name": "a/b/c/Test",
            "type": "api"
        },
        {
            "id": 1,
            "name": "Chat",
            "type": "msg"
        },
        {
            "id": 2,
            "name": "Test",
            "type": "api"
        }
    ],
    "types": {
        "a/b/c/PtlTest/ReqTest": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "a/b/c/PtlTest/ResTest": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "reply",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "chat",
                    "type": {
                        "type": "Reference",
                        "target": "MsgChat/MsgChat"
                    },
                    "optional": true
                }
            ]
        },
        "MsgChat/MsgChat": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "channel",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "userName",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "content",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "time",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlTest/ReqTest": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "PtlTest/ResTest": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "reply",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        }
    }
};