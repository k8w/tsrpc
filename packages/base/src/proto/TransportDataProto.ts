import { SchemaType, TSBufferSchema } from "tsbuffer-schema";

export const TransportDataProto: {
  ServerInputData: TSBufferSchema,
  ServerOutputData: TSBufferSchema,
  [key: string]: TSBufferSchema
} = {
  "ServerInputData": {
    "type": SchemaType.Interface,
    "properties": [
      {
        "id": 0,
        "name": "serviceId",
        "type": {
          "type": SchemaType.Number,
          "scalarType": "uint"
        }
      },
      {
        "id": 1,
        "name": "buffer",
        "type": {
          "type": SchemaType.Buffer,
          "arrayType": "Uint8Array"
        }
      },
      {
        "id": 2,
        "name": "sn",
        "type": {
          "type": SchemaType.Number,
          "scalarType": "uint"
        },
        "optional": true
      }
    ]
  },
  "ServerOutputData": {
    "type": SchemaType.Interface,
    "properties": [
      {
        "id": 0,
        "name": "buffer",
        "type": {
          "type": SchemaType.Buffer,
          "arrayType": "Uint8Array"
        },
        "optional": true
      },
      {
        "id": 1,
        "name": "error",
        "type": {
          "type": SchemaType.Reference,
          "target": "TsrpcErrorData"
        },
        "optional": true
      },
      {
        "id": 2,
        "name": "serviceId",
        "type": {
          "type": SchemaType.Number,
          "scalarType": "uint"
        },
        "optional": true
      },
      {
        "id": 3,
        "name": "sn",
        "type": {
          "type": SchemaType.Number,
          "scalarType": "uint"
        },
        "optional": true
      }
    ]
  },
  "TsrpcErrorData": {
    "type": SchemaType.Interface,
    "properties": [
      {
        "id": 0,
        "name": "message",
        "type": {
          "type": SchemaType.String
        }
      },
      {
        "id": 1,
        "name": "type",
        "type": {
          "type": SchemaType.Reference,
          "target": "TsrpcErrorType"
        }
      },
      {
        "id": 2,
        "name": "code",
        "type": {
          "type": SchemaType.Union,
          "members": [
            {
              "id": 0,
              "type": {
                "type": SchemaType.String
              }
            },
            {
              "id": 1,
              "type": {
                "type": SchemaType.Number,
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
        "type": SchemaType.Any
      }
    }
  },
  "TsrpcErrorType": {
    "type": SchemaType.Enum,
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