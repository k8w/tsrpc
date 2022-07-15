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
              "name": "sn",
              "type": {
                "type": "Number",
                "scalarType": "uint"
              },
              "optional": true
            },
            {
              "id": 2,
              "name": "serviceId",
              "type": {
                "type": "Number",
                "scalarType": "uint"
              }
            },
            {
              "id": 3,
              "name": "data",
              "type": {
                "type": "Buffer",
                "arrayType": "Uint8Array"
              }
            },
            {
              "id": 4,
              "name": "header",
              "type": {
                "type": "Interface",
                "properties": [
                  {
                    "id": 0,
                    "name": "protoInfo",
                    "type": {
                      "type": "Reference",
                      "target": "ProtoInfo"
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
              "name": "header",
              "type": {
                "type": "Reference",
                "target": "ApiReturnHeader"
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
              "name": "error",
              "type": {
                "type": "Reference",
                "target": "TsrpcErrorData"
              }
            },
            {
              "id": 3,
              "name": "header",
              "type": {
                "type": "Reference",
                "target": "ApiReturnHeader"
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
            },
            {
              "id": 3,
              "name": "header",
              "type": {
                "type": "Interface",
                "indexSignature": {
                  "keyType": "String",
                  "type": {
                    "type": "Any"
                  }
                }
              },
              "optional": true
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
                "literal": "connect"
              }
            },
            {
              "id": 1,
              "name": "header",
              "type": {
                "type": "Interface",
                "properties": [
                  {
                    "id": 0,
                    "name": "protoInfo",
                    "type": {
                      "type": "Reference",
                      "target": "ProtoInfo"
                    }
                  }
                ],
                "indexSignature": {
                  "keyType": "String",
                  "type": {
                    "type": "Any"
                  }
                }
              },
              "optional": true
            }
          ]
        }
      },
      {
        "id": 6,
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
        "name": "version",
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
  "ApiReturnHeader": {
    "type": "Interface",
    "properties": [
      {
        "id": 0,
        "name": "protoInfo",
        "type": {
          "type": "Reference",
          "target": "ProtoInfo"
        },
        "optional": true
      },
      {
        "id": 1,
        "name": "warning",
        "type": {
          "type": "String"
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
        "value": "ServerError"
      },
      {
        "id": 2,
        "value": "ClientError"
      },
      {
        "id": 3,
        "value": "ApiError"
      }
    ]
  }
};