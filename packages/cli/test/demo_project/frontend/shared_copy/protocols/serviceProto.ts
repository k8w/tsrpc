import { ServiceProto } from 'tsrpc-proto';
import { ReqAddData, ResAddData } from './PtlAddData';
import { ReqDelData, ResDelData } from './PtlDelData';
import { ReqGetData, ResGetData } from './PtlGetData';
import { ReqLevel3, ResLevel3 } from './user/level1/level2/level31/PtlLevel3';
import { ReqLevel3Plus, ResLevel3Plus } from './user/level1/level2/level31/PtlLevel3Plus';
import { ReqLevel3 as ReqLevel3_1, ResLevel3 as ResLevel3_1 } from './user/level1/level2/PtlLevel3';
import { ReqLevel3Plus as ReqLevel3Plus_1, ResLevel3Plus as ResLevel3Plus_1 } from './user/level1/level2/PtlLevel3Plus';
import { ReqLevel3 as ReqLevel3_2, ResLevel3 as ResLevel3_2 } from './user/level1/level21/PtlLevel3';
import { ReqLevel3Plus as ReqLevel3Plus_2, ResLevel3Plus as ResLevel3Plus_2 } from './user/level1/level21/PtlLevel3Plus';
import { ReqLevel1XXX, ResLevel1XXX } from './user/level1/PtlLevel1XXX';
import { ReqLevel1YYY, ResLevel1YYY } from './user/level1/PtlLevel1YYY';
import { ReqAddUser, ResAddUser } from './user/PtlAddUser';
import { ReqDelUser, ResDelUser } from './user/PtlDelUser';

export interface ServiceType {
    api: {
        "AddData": {
            req: ReqAddData,
            res: ResAddData
        },
        "DelData": {
            req: ReqDelData,
            res: ResDelData
        },
        "GetData": {
            req: ReqGetData,
            res: ResGetData
        },
        "user/level1/level2/level31/Level3": {
            req: ReqLevel3,
            res: ResLevel3
        },
        "user/level1/level2/level31/Level3Plus": {
            req: ReqLevel3Plus,
            res: ResLevel3Plus
        },
        "user/level1/level2/Level3": {
            req: ReqLevel3_1,
            res: ResLevel3_1
        },
        "user/level1/level2/Level3Plus": {
            req: ReqLevel3Plus_1,
            res: ResLevel3Plus_1
        },
        "user/level1/level21/Level3": {
            req: ReqLevel3_2,
            res: ResLevel3_2
        },
        "user/level1/level21/Level3Plus": {
            req: ReqLevel3Plus_2,
            res: ResLevel3Plus_2
        },
        "user/level1/Level1XXX": {
            req: ReqLevel1XXX,
            res: ResLevel1XXX
        },
        "user/level1/Level1YYY": {
            req: ReqLevel1YYY,
            res: ResLevel1YYY
        },
        "user/AddUser": {
            req: ReqAddUser,
            res: ResAddUser
        },
        "user/DelUser": {
            req: ReqDelUser,
            res: ResDelUser
        }
    },
    msg: {

    }
}

export const serviceProto: ServiceProto<ServiceType> = {
    "version": 21,
    "services": [
        {
            "id": 100,
            "name": "AddData",
            "type": "api"
        },
        {
            "id": 103,
            "name": "DelData",
            "type": "api"
        },
        {
            "id": 102,
            "name": "GetData",
            "type": "api"
        },
        {
            "id": 110,
            "name": "user/level1/level2/level31/Level3",
            "type": "api"
        },
        {
            "id": 111,
            "name": "user/level1/level2/level31/Level3Plus",
            "type": "api"
        },
        {
            "id": 104,
            "name": "user/level1/level2/Level3",
            "type": "api"
        },
        {
            "id": 107,
            "name": "user/level1/level2/Level3Plus",
            "type": "api"
        },
        {
            "id": 112,
            "name": "user/level1/level21/Level3",
            "type": "api"
        },
        {
            "id": 113,
            "name": "user/level1/level21/Level3Plus",
            "type": "api"
        },
        {
            "id": 108,
            "name": "user/level1/Level1XXX",
            "type": "api"
        },
        {
            "id": 109,
            "name": "user/level1/Level1YYY",
            "type": "api"
        },
        {
            "id": 105,
            "name": "user/AddUser",
            "type": "api"
        },
        {
            "id": 106,
            "name": "user/DelUser",
            "type": "api"
        }
    ],
    "types": {
        "PtlAddData/ReqAddData": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "content",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "PtlAddData/ResAddData": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "time",
                    "type": {
                        "type": "Date"
                    }
                }
            ]
        },
        "PtlDelData/ReqDelData": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "dataIds",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "String"
                        }
                    }
                },
                {
                    "id": 1,
                    "name": "force",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                }
            ]
        },
        "PtlDelData/ResDelData": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "deletedCount",
                    "type": {
                        "type": "Number",
                        "scalarType": "uint"
                    }
                }
            ]
        },
        "PtlGetData/ReqGetData": {
            "type": "Interface"
        },
        "PtlGetData/ResGetData": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "data",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Interface",
                            "properties": [
                                {
                                    "id": 0,
                                    "name": "content",
                                    "type": {
                                        "type": "String"
                                    }
                                },
                                {
                                    "id": 1,
                                    "name": "time",
                                    "type": {
                                        "type": "Date"
                                    }
                                }
                            ]
                        }
                    }
                }
            ]
        },
        "user/level1/level2/level31/PtlLevel3/ReqLevel3": {
            "type": "Reference",
            "target": "user/level1/level2/level31/PtlLevel3/Level3"
        },
        "user/level1/level2/level31/PtlLevel3/Level3": {
            "target": {
                "type": "Reference",
                "target": "user/level1/level2/level31/PtlLevel3/AAA"
            },
            "keys": [
                "a",
                "b"
            ],
            "type": "Pick"
        },
        "user/level1/level2/level31/PtlLevel3/AAA": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "a",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "b",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "c",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "user/level1/level2/level31/PtlLevel3/ResLevel3": {
            "type": "Interface"
        },
        "user/level1/level2/level31/PtlLevel3Plus/ReqLevel3Plus": {
            "type": "Interface"
        },
        "user/level1/level2/level31/PtlLevel3Plus/ResLevel3Plus": {
            "type": "Interface"
        },
        "user/level1/level2/PtlLevel3/ReqLevel3": {
            "type": "Reference",
            "target": "user/level1/level2/PtlLevel3/Level3"
        },
        "user/level1/level2/PtlLevel3/Level3": {
            "target": {
                "type": "Reference",
                "target": "user/level1/level2/PtlLevel3/AAA"
            },
            "keys": [
                "a",
                "b"
            ],
            "type": "Pick"
        },
        "user/level1/level2/PtlLevel3/AAA": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "a",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "b",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "c",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "user/level1/level2/PtlLevel3/ResLevel3": {
            "type": "Interface"
        },
        "user/level1/level2/PtlLevel3Plus/ReqLevel3Plus": {
            "type": "Interface"
        },
        "user/level1/level2/PtlLevel3Plus/ResLevel3Plus": {
            "type": "Interface"
        },
        "user/level1/level21/PtlLevel3/ReqLevel3": {
            "type": "Reference",
            "target": "user/level1/level21/PtlLevel3/Level3"
        },
        "user/level1/level21/PtlLevel3/Level3": {
            "target": {
                "type": "Reference",
                "target": "user/level1/level21/PtlLevel3/AAA"
            },
            "keys": [
                "a",
                "b"
            ],
            "type": "Pick"
        },
        "user/level1/level21/PtlLevel3/AAA": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "a",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "b",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "c",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "user/level1/level21/PtlLevel3/ResLevel3": {
            "type": "Interface"
        },
        "user/level1/level21/PtlLevel3Plus/ReqLevel3Plus": {
            "type": "Interface"
        },
        "user/level1/level21/PtlLevel3Plus/ResLevel3Plus": {
            "type": "Interface"
        },
        "user/level1/PtlLevel1XXX/ReqLevel1XXX": {
            "type": "Interface"
        },
        "user/level1/PtlLevel1XXX/ResLevel1XXX": {
            "type": "Interface"
        },
        "user/level1/PtlLevel1YYY/ReqLevel1YYY": {
            "type": "Interface"
        },
        "user/level1/PtlLevel1YYY/ResLevel1YYY": {
            "type": "Interface"
        },
        "user/PtlAddUser/ReqAddUser": {
            "type": "Interface"
        },
        "user/PtlAddUser/ResAddUser": {
            "type": "Interface"
        },
        "user/PtlDelUser/ReqDelUser": {
            "type": "Interface"
        },
        "user/PtlDelUser/ResDelUser": {
            "type": "Interface"
        }
    }
};