export const TransportDataProto = {
  "TransportDataSchema": {
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
              "name": "serviceId",
              "type": {
                "type": "Number",
                "scalarType": "uint"
              }
            },
            {
              "id": 2,
              "name": "data",
              "type": {
                "type": "Buffer",
                "arrayType": "Uint8Array"
              }
            },
            {
              "id": 3,
              "name": "sn",
              "type": {
                "type": "Number",
                "scalarType": "uint"
              },
              "optional": true
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
              "name": "sn",
              "type": {
                "type": "Number",
                "scalarType": "uint"
              },
              "optional": true
            },
            {
              "id": 2,
              "name": "data",
              "type": {
                "type": "Buffer",
                "arrayType": "Uint8Array"
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
              "name": "sn",
              "type": {
                "type": "Number",
                "scalarType": "uint"
              },
              "optional": true
            },
            {
              "id": 2,
              "name": "err",
              "type": {
                "type": "Reference",
                "target": "TsrpcErrorData"
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
              "name": "serviceId",
              "type": {
                "type": "Number",
                "scalarType": "uint"
              }
            },
            {
              "id": 2,
              "name": "data",
              "type": {
                "type": "Buffer",
                "arrayType": "Uint8Array"
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
                "type": "Number",
                "scalarType": "uint"
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
            },
            {
              "id": 1,
              "name": "data",
              "type": {
                "type": "Union",
                "members": [
                  {
                    "id": 0,
                    "type": {
                      "type": "Buffer",
                      "arrayType": "Uint8Array"
                    }
                  },
                  {
                    "id": 1,
                    "type": {
                      "type": "String"
                    }
                  }
                ]
              }
            }
          ]
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
export const TransportDataProtoJson: typeof TransportDataProto = Object.merge({}, TransportDataProto);
TransportDataProtoJson.TransportDataSchema.members.forEach(v => {
  v.type.properties.forEach(p => {
    if (p.name === 'data') {
      p.type = { type: 'Any' }
    }
  })
})