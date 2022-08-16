import { InterfaceTypeSchema, TSBufferProto, UnionTypeSchema } from "tsbuffer-schema";

export const TransportDataProto: TSBufferProto = {
  "BoxBuffer": {
    "type": "Union",
    "members": [
      {
        "id": 0,
        "type": {
          "type": "Interface",
          "properties": [
            {
              "id": 0,
              "name": "type",
              "type": {
                "type": "Literal",
                "literal": "req"
              }
            },
            {
              "id": 1,
              "name": "body",
              "type": {
                "type": "Buffer",
                "arrayType": "Uint8Array"
              }
            },
            {
              "id": 2,
              "name": "apiName",
              "type": {
                "type": "String"
              }
            },
            {
              "id": 3,
              "name": "sn",
              "type": {
                "type": "Number"
              }
            },
            {
              "id": 4,
              "name": "protoInfo",
              "type": {
                "type": "Reference",
                "target": "ProtoInfo"
              },
              "optional": true
            }
          ]
        }
      },
      {
        "id": 1,
        "type": {
          "type": "Interface",
          "properties": [
            {
              "id": 0,
              "name": "type",
              "type": {
                "type": "Literal",
                "literal": "res"
              }
            },
            {
              "id": 1,
              "name": "body",
              "type": {
                "type": "Buffer",
                "arrayType": "Uint8Array"
              }
            },
            {
              "id": 2,
              "name": "sn",
              "type": {
                "type": "Number"
              }
            },
            {
              "id": 3,
              "name": "protoInfo",
              "type": {
                "type": "Reference",
                "target": "ProtoInfo"
              },
              "optional": true
            }
          ]
        }
      },
      {
        "id": 2,
        "type": {
          "type": "Interface",
          "properties": [
            {
              "id": 0,
              "name": "type",
              "type": {
                "type": "Literal",
                "literal": "err"
              }
            },
            {
              "id": 1,
              "name": "err",
              "type": {
                "type": "Reference",
                "target": "TsrpcErrorData"
              }
            },
            {
              "id": 2,
              "name": "sn",
              "type": {
                "type": "Number"
              }
            },
            {
              "id": 3,
              "name": "protoInfo",
              "type": {
                "type": "Reference",
                "target": "ProtoInfo"
              },
              "optional": true
            }
          ]
        }
      },
      {
        "id": 3,
        "type": {
          "type": "Interface",
          "properties": [
            {
              "id": 0,
              "name": "type",
              "type": {
                "type": "Literal",
                "literal": "msg"
              }
            },
            {
              "id": 1,
              "name": "body",
              "type": {
                "type": "Buffer",
                "arrayType": "Uint8Array"
              }
            },
            {
              "id": 2,
              "name": "msgName",
              "type": {
                "type": "String"
              }
            }
          ]
        }
      },
      {
        "id": 4,
        "type": {
          "type": "Interface",
          "properties": [
            {
              "id": 0,
              "name": "type",
              "type": {
                "type": "Literal",
                "literal": "heartbeat"
              }
            },
            {
              "id": 1,
              "name": "sn",
              "type": {
                "type": "Number"
              }
            },
            {
              "id": 2,
              "name": "isReply",
              "type": {
                "type": "Boolean"
              },
              "optional": true
            }
          ]
        }
      },
      {
        "id": 5,
        "type": {
          "type": "Interface",
          "properties": [
            {
              "id": 0,
              "name": "type",
              "type": {
                "type": "Literal",
                "literal": "custom"
              }
            }
          ],
          "indexSignature": {
            "keyType": "String",
            "type": {
              "type": "Any"
            }
          }
        }
      }
    ]
  },
  "ProtoInfo": {
    "type": "Interface",
    "properties": [
      {
        "id": 0,
        "name": "lastModified",
        "type": {
          "type": "String"
        }
      },
      {
        "id": 1,
        "name": "md5",
        "type": {
          "type": "String"
        }
      },
      {
        "id": 2,
        "name": "tsrpcVersion",
        "type": {
          "type": "String"
        }
      },
      {
        "id": 3,
        "name": "nodeVersion",
        "type": {
          "type": "String"
        },
        "optional": true
      }
    ]
  },
  "TsrpcErrorData": {
    "type": "Interface",
    "properties": [
      {
        "id": 0,
        "name": "message",
        "type": {
          "type": "String"
        }
      },
      {
        "id": 1,
        "name": "type",
        "type": {
          "type": "Reference",
          "target": "TsrpcErrorType"
        }
      },
      {
        "id": 2,
        "name": "code",
        "type": {
          "type": "Union",
          "members": [
            {
              "id": 0,
              "type": {
                "type": "String"
              }
            },
            {
              "id": 1,
              "type": {
                "type": "Number",
                "scalarType": "int"
              }
            }
          ]
        },
        "optional": true
      }
    ],
    "indexSignature": {
      "keyType": "String",
      "type": {
        "type": "Any"
      }
    }
  },
  "TsrpcErrorType": {
    "type": "Enum",
    "members": [
      {
        "id": 0,
        "value": "NetworkError"
      },
      {
        "id": 1,
        "value": "RemoteError"
      },
      {
        "id": 2,
        "value": "LocalError"
      },
      {
        "id": 3,
        "value": "ApiError"
      },
      {
        "id": 1,
        "value": "RemoteError"
      },
      {
        "id": 2,
        "value": "LocalError"
      }
    ]
  }
};

// JSON data is any (json obj)
TransportDataProto['BoxJsonObject'] = Object.merge({}, TransportDataProto['BoxBuffer']);
(TransportDataProto['BoxJsonObject'] as UnionTypeSchema).members.forEach(v => {
  (v.type as InterfaceTypeSchema).properties!.forEach(p => {
    // body -> any
    if (p.name === 'body') {
      p.type = { type: 'Any' }
    }
    // serviceId -> serviceName
    else if (p.name === 'serviceId') {
      p.name = 'serviceName';
      p.type = {
        type: 'String'
      }
    }
  })
})