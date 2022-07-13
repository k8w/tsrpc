import { OpenAPIV3 } from 'openapi-types';
import { IntersectionTypeSchema, OmitTypeSchema, OverwriteTypeSchema, PartialTypeSchema, PickTypeSchema, SchemaType, TSBufferProto, TSBufferSchema, UnionTypeSchema } from 'tsbuffer-schema';
import { FlatInterfaceTypeSchema, TSBufferValidator } from 'tsbuffer-validator';
import { ServiceProto } from 'tsrpc-proto';
import { processString } from 'typescript-formatter';
import { ApiService, ServiceMapUtil } from './ServiceMapUtil';
import { TSAPI } from './TSAPI';

// https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.1.0.md
// https://tools.ietf.org/html/draft-bhutton-json-schema-00#section-4.2.1

export class ApiDocUtil {

    static protoHelper: TSBufferValidator['protoHelper'];

    static init(proto: ServiceProto<any>) {
        // Custom types
        proto.types['?mongodb/ObjectId'] = proto.types['?mongodb/ObjectID'] =
            proto.types['?bson/ObjectId'] = proto.types['?bson/ObjectID'] = {
                type: SchemaType.Custom,
                validate: v => ({ isSucc: true })
            };

        let generator = new TSBufferValidator(proto.types);
        this.protoHelper = generator.protoHelper;
    }

    static toOpenAPI(proto: ServiceProto<any>): OpenAPIV3.Document {
        // schemas
        let schemas: NonNullable<OpenAPIV3.ComponentsObject['schemas']> = {};
        for (let key in proto.types) {
            schemas[key.replace(/[\.\/]/g, '_')] = this.toSchemaObject(proto.types[key]);
        }

        let apiSvcs = Object.values(ServiceMapUtil.getServiceMap(proto).apiName2Service) as ApiService[];
        let pathObj: OpenAPIV3.PathsObject = Object.fromEntries(apiSvcs.map(v => {
            let nameArr = v.name.split('/');
            let lastName = nameArr.last()!;
            let tags = nameArr.length > 1 ? [nameArr.slice(0, nameArr.length - 1).join('/')] : undefined;

            let pathValue: OpenAPIV3.PathItemObject = {
                post: {
                    tags: tags,
                    description: (schemas[v.reqSchemaId] as OpenAPIV3.SchemaObject)?.description,
                    operationId: v.name,
                    requestBody: {
                        description: `Req<${lastName}>`,
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/' + v.reqSchemaId.replace(/[\.\/]/g, '_')
                                }
                            }
                        }
                    },
                    responses: {
                        200: {
                            description: 'Success',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        description: `ApiReturn<Res${lastName}>`,
                                        properties: {
                                            isSucc: {
                                                type: 'boolean',
                                                enum: [true],
                                                default: true
                                            },
                                            res: {
                                                $ref: '#/components/schemas/' + v.resSchemaId.replace(/[\.\/]/g, '_')
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        default: {
                            description: 'Error',
                            $ref: '#/components/responses/error'
                        }
                    }
                }
            };
            return ['/' + v.name, pathValue];
        }));

        let output: OpenAPIV3.Document = {
            openapi: '3.0.0',
            info: {
                title: 'TSRPC Open API',
                version: '1.0.0'
            },
            paths: pathObj,
            components: {
                schemas: schemas,
                responses: {
                    error: {
                        description: 'Error',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    title: 'API 错误',
                                    description: '业务错误（ApiError）返回 HTTP 状态码 200，其它错误返回 HTTP 状态码 500',
                                    properties: {
                                        isSucc: {
                                            type: 'boolean',
                                            enum: [false],
                                            default: false
                                        },
                                        err: {
                                            type: 'object',
                                            description: 'TsrpcError',
                                            properties: {
                                                message: {
                                                    type: 'string'
                                                },
                                                type: {
                                                    type: 'string',
                                                    enum: ['ApiError', 'NetworkError', 'ServerError', 'ClientError']
                                                },
                                                code: {
                                                    oneOf: [
                                                        { type: 'string' },
                                                        { type: 'integer' }
                                                    ],
                                                    nullable: true
                                                }
                                            },
                                            required: ['message', 'type']
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };
        return output;
    }

    static toSchemaObject(schema: TSBufferSchema): OpenAPIV3.SchemaObject {
        let output: OpenAPIV3.SchemaObject = {};

        switch (schema.type) {
            case SchemaType.Boolean:
                output.type = 'boolean';
                break;
            case SchemaType.Number:
                if (schema.scalarType && schema.scalarType.indexOf('int') > -1) {
                    output.type = 'integer';
                }
                else {
                    output.type = 'number';
                }
                break;
            case SchemaType.String:
                output.type = 'string';
                break;
            case SchemaType.Array:
                output = {
                    ...output,
                    type: 'array',
                    items: this.toSchemaObject(schema.elementType)
                }
                break;
            case SchemaType.Tuple:
                output = {
                    ...output,
                    type: 'array',
                    prefixItems: schema.elementTypes.map(v => this.toSchemaObject(v)) as OpenAPIV3.SchemaObject[]
                } as any
                break;
            case SchemaType.Enum:
                if (schema.members.every(v => typeof v.value === 'string')) {
                    output.type = 'string';
                }
                else if (schema.members.every(v => typeof v.value === 'number')) {
                    output.type = 'number';
                }
                else {
                    output.oneOf = [{ type: 'string' }, { type: 'number' }]
                }
                output.enum = schema.members.map(v => v.value);
                break;
            case SchemaType.Any:
                output.type = 'object';
                break;
            case SchemaType.Literal:
                if (schema.literal === null) {
                    output.nullable = true;
                    break;
                }

                let type = typeof schema.literal;
                if (type === 'bigint' || type === 'symbol' || type === 'function' || type === 'undefined') {
                    break;
                }
                output.type = type;
                output.enum = [schema.literal];
                break;
            case SchemaType.Object:
                output.type = 'object';
                break;
            case SchemaType.Interface: {
                output.type = 'object';

                // properties
                if (schema.properties) {
                    let schemaProperties: NonNullable<(typeof schema)['properties']> = Object.merge([], schema.properties);
                    output.properties = Object.fromEntries(schemaProperties.map(property => {
                        // A | null | undefined -> A?
                        if (property.type.type === SchemaType.Union) {
                            let members = property.type.members.filter(v => !(v.type.type === SchemaType.Literal && v.type.literal == null));
                            if (members.length !== property.type.members.length) {
                                property.optional = true;
                                if (members.length === 1) {
                                    property.type = members[0].type;
                                }
                                else {
                                    property.type.members = members;
                                }
                            }
                        }
                        return [property.name, this.toSchemaObject(property.type)]
                    }));

                    output.required = schemaProperties.filter(v => !v.optional).map(v => v.name);
                    if (output.required.length === 0) {
                        output.required = undefined;
                    }
                }
                else {
                    output.properties = {};
                }

                // index signature
                if (schema.indexSignature) {
                    output.additionalProperties = this.toSchemaObject(schema.indexSignature.type);
                }

                // extends
                if (schema.extends) {
                    output = {
                        allOf: [
                            ...schema.extends.map(v => this.toSchemaObject(v.type)),
                            output
                        ]
                    }
                }

                break;
            }
            case SchemaType.Buffer:
                output.type = 'string';
                output.format = 'base64';
                break;
            case SchemaType.IndexedAccess: {
                let parsed = this.protoHelper.parseReference(schema);
                output = {
                    ...output,
                    ...this.toSchemaObject(parsed)
                }
                break;
            }
            case SchemaType.Reference:
                (output as any).$ref = '#/components/schemas/' + schema.target.replace(/[\.\/]/g, '_');
                break;
            case SchemaType.Union: {
                let members = schema.members.filter(v => {
                    let type = v.type;
                    return !(type.type === SchemaType.Literal && type.literal == null)
                });

                // null | undefined
                if (members.length === 0) {
                    output.nullable = true;
                    break;
                }
                // A | null | undefined
                else if (members.length === 1) {
                    output = this.toSchemaObject(members[0].type);
                }
                // >= 2 members
                else {
                    // Check if discriminator
                    // Every member is interface
                    let flats = members.map(v => this.protoHelper.isInterface(v.type) ? this.protoHelper.getFlatInterfaceSchema(v.type) : null);
                    if (flats.every(v => !!v)) {
                        // Every member has a same literal property
                        flats[0]?.properties.some(disProp => {
                            let literalTypes = flats.map(f => {
                                let prop = f?.properties.find(v => v.name === disProp.name);
                                if (!prop || prop.type.type !== SchemaType.Literal || prop.optional) {
                                    return null;
                                }
                                return prop.type;
                            })
                            // Every literal value is different
                            if (literalTypes.every(v => !!v)) {
                                let uniqueLiterals = literalTypes.map(v => v!.literal).distinct();
                                if (uniqueLiterals.length === literalTypes.length) {
                                    // Yes! This is the discriminator key
                                    output.oneOf = members.map(v => this.toSchemaObject(v.type));
                                    output.discriminator = {
                                        propertyName: disProp.name,
                                        // mapping: Object.fromEntries(flats.map((v, i) => {
                                        //     let lProp = v!.properties.find(v1 => v1.name === disProp.name)!;
                                        //     let lType = lProp.type as LiteralTypeSchema;
                                        //     return [lType.literal, this.toSchemaObject(members[i].type)]
                                        // }))
                                    }
                                }
                            }
                        })
                    }

                    // Not discriminator: anyOf
                    if (!output.discriminator) {
                        let anyOf = members.map(v => JSON.stringify(this.toSchemaObject(v.type))).distinct().map(v => JSON.parse(v));
                        if (anyOf.length > 1) {
                            output.anyOf = anyOf;
                        }
                        else {
                            output = anyOf[0];
                        }
                    }
                }

                // X | null
                if (members.length !== schema.members.length) {
                    output.nullable = true;
                }
                break;
            }
            case SchemaType.Intersection:
                output.allOf = schema.members.map(v => this.toSchemaObject(v.type));
                break;
            case SchemaType.NonNullable:
                output = this.toSchemaObject(schema.target);
                output.nullable = false;
                break;
            case SchemaType.Date:
                output.type = 'string';
                output.format = 'date-time';
                break;
            case SchemaType.Pick:
            case SchemaType.Partial:
            case SchemaType.Omit:
            case SchemaType.Overwrite: {
                let parsed = this._parseMappedType(schema);
                output = this.toSchemaObject(parsed);
                break;
            }
            case SchemaType.Custom:
                output.type = 'string';
                break;
        }

        output.description = schema.comment;
        return output;
    }

    private static _refStack: string[] = [];
    static async toCode(proto: TSBufferProto, schemaId: string, typeName: string): Promise<string> {
        let schema = proto[schemaId];

        // Get circular refs
        this._genCircularData = {
            refStack: [],
            proto: proto,
            output: []
        }
        this._generateCircularRefs(schema);

        // Circular refs would be kept
        this._toCodeData = {
            refs: this._genCircularData.output
        }
        let code = this._toCode(schema, { isRoot: true });
        code = `${this.protoHelper.isInterface(schema) ? `interface ${typeName}` : `type ${typeName} =`} ${code}`;

        // Generate code of refs
        if (this._toCodeData.refs.length) {
            code += '\n\n' + this._toCodeData.refs.map(v => {
                let refName = v.split('/').last()!;
                let refCode = this._toCode(proto[v], { isRoot: true });
                refCode = `${this.protoHelper.isInterface(schema) ? `interface ${refName}` : `type ${refName} =`} ${refCode}`;
                if (proto[v].comment) {
                    refCode = this._toCodeComment(proto[v].comment!) + '\n' + refCode;
                }
                return refCode;
            }).join('\n\n');
        }

        // Clear
        this._genCircularData = undefined as any;
        this._toCodeData = undefined as any;

        // Format
        let format = await processString('a.ts', code, {} as any);
        return format.dest;
    }

    // #region _generateCircularRefs
    /** _generateCircularRefs 期间的共享数据，需要在方法调用前初始化 */
    private static _genCircularData: {
        refStack: string[],
        proto: TSBufferProto,
        output: string[]
    }
    private static _generateCircularRefs(schema: TSBufferSchema) {
        switch (schema.type) {
            case SchemaType.Array:
                this._generateCircularRefs(schema.elementType);
                return;
            case SchemaType.Tuple:
                schema.elementTypes.forEach(v => { this._generateCircularRefs(v) });
                return;
            case SchemaType.Interface:
                schema.extends?.forEach(v => { this._generateCircularRefs(v.type) });
                schema.properties?.forEach(v => { this._generateCircularRefs(v.type) });
                schema.indexSignature && this._generateCircularRefs(schema.indexSignature.type);
                return;
            case SchemaType.IndexedAccess:
                this._generateCircularRefs(schema.objectType);
                return;
            case SchemaType.Reference:
                if (this._genCircularData.output.includes(schema.target)) {
                    return;
                }
                if (this._genCircularData.refStack.includes(schema.target)) {
                    this._genCircularData.output.push(schema.target);
                    return;
                }
                this._genCircularData?.refStack.push(schema.target);
                this._generateCircularRefs(this._genCircularData.proto[schema.target])
                this._genCircularData?.refStack.pop();
                return;
            case SchemaType.Union:
            case SchemaType.Intersection:
                schema.members.forEach(v => { this._generateCircularRefs(v.type) });
                return;
            case SchemaType.NonNullable:
                this._generateCircularRefs(schema.target);
                return;
            case SchemaType.Pick:
            case SchemaType.Partial:
            case SchemaType.Omit:
                this._generateCircularRefs(schema.target);
                return;
            case SchemaType.Overwrite:
                this._generateCircularRefs(schema.target);
                this._generateCircularRefs(schema.overwrite);
                return;
        }
    }
    // #endregion _generateCircularRefs

    // #region _toCode
    private static _toCodeData: {
        refs: string[]
    };
    private static _toCode(schema: TSBufferSchema, options?: { isRoot?: boolean, schemaId?: string }): string {
        switch (schema.type) {
            case SchemaType.Boolean:
                return 'boolean';
            case SchemaType.Number:
                if (schema.scalarType && schema.scalarType !== 'double') {
                    return `/*${schema.scalarType}*/ number`;
                }
                return 'number';
            case SchemaType.String:
                return 'string';
            case SchemaType.Array:
                let elemType = this.protoHelper.isTypeReference(schema.elementType) ? this.protoHelper.parseReference(schema.elementType) : schema.elementType;
                let code = this._toCode(schema.elementType);
                return (elemType.type === SchemaType.Union || elemType.type === SchemaType.Intersection) ? `(${code})[]` : `${code}[]`;
            case SchemaType.Tuple:
                return `[${schema.elementTypes.map((v, i) => this._toCode(v)
                    + (schema.optionalStartIndex !== undefined && i >= schema.optionalStartIndex ? '?' : ''))
                    .join(', ')}]`;
            case SchemaType.Enum:
                return schema.members.map(v => this._toCode({ type: SchemaType.Literal, literal: v.value })).join(' | ');
            case SchemaType.Any:
                return 'any';
            case SchemaType.Literal:
                if (schema.literal === undefined) {
                    return 'undefined';
                }
                return JSON.stringify(schema.literal);
            case SchemaType.Object:
                return 'object';
            case SchemaType.Pick:
            case SchemaType.Partial:
            case SchemaType.Omit:
            case SchemaType.Overwrite: {
                let parsed = this._parseMappedType(schema);
                return this._toCode(parsed);
            }
            case SchemaType.Interface: {
                let flat = this.protoHelper.getFlatInterfaceSchema(schema);
                let props: string[] = [];
                for (let prop of flat.properties) {
                    let propStr = '';

                    // Comment
                    if (prop.type.comment) {
                        propStr += `${this._toCodeComment(prop.type.comment)}\n`
                    }
                    // 字段无 Comment，但是是引用
                    else if (this.protoHelper.isTypeReference(prop.type)) {
                        // 引用有 Comment
                        let parsedSchema = this.protoHelper.parseReference(prop.type);
                        if (parsedSchema.comment) {
                            propStr += `${this._toCodeComment(parsedSchema.comment)}\n`
                        }
                    }

                    propStr += (`${/^[a-z_]/i.test(prop.name) ? prop.name : `'${prop.name}'`}${prop.optional ? '?' : ''}: ${this._toCode(prop.type)}`);
                    props.push(propStr);
                }
                if (flat.indexSignature) {
                    props.push(`[key: ${flat.indexSignature.keyType.toLowerCase()}]: ${this._toCode(flat.indexSignature.type)}`)
                }

                return (props.length > 1 || options?.isRoot) ? `{\n${props.join(',\n')}\n}` : `{${props.join(', ')}}`
            }
            case SchemaType.Buffer:
                return '/*base64*/ string';
            case SchemaType.IndexedAccess:
                return this._toCode(this.protoHelper.parseReference(schema));
            case SchemaType.Reference: {
                if (this._toCodeData.refs.includes(schema.target)) {
                    return schema.target.split('/').last()!;
                }
                return this._toCode(this.protoHelper.parseReference(schema), { schemaId: schema.target });
            }
            case SchemaType.Union:
                return schema.members.map(v => {
                    let parsed = this.protoHelper.isTypeReference(v.type) ? this.protoHelper.parseReference(v.type) : v.type;
                    let code = this._toCode(v.type);
                    return parsed.type === SchemaType.Intersection ? `(${code})` : code;
                }).distinct().join(' | ');
            case SchemaType.Intersection:
                return schema.members.map(v => {
                    let parsed = this.protoHelper.isTypeReference(v.type) ? this.protoHelper.parseReference(v.type) : v.type;
                    let code = this._toCode(v.type);
                    return parsed.type === SchemaType.Union ? `(${code})` : code;
                }).distinct().join(' & ');
            case SchemaType.NonNullable:
                return `NonNullable<${this._toCode(schema.target)}>`;
            case SchemaType.Date:
                return '/*datetime*/ string';
            case SchemaType.Custom: {
                let schemaId = options?.schemaId?.toLowerCase();
                if (schemaId === '?mongodb/objectid' || schemaId === '?json/objectid') {
                    return '/*ObjectId*/ string';
                }
                return 'string';
            }
        }

        return '';
    }
    // #endregion _toCode

    private static _parseMappedType(schema: PickTypeSchema | OmitTypeSchema | OverwriteTypeSchema | PartialTypeSchema): FlatInterfaceTypeSchema | UnionTypeSchema | IntersectionTypeSchema {
        if (this.protoHelper.isInterface(schema)) {
            return this.protoHelper.getFlatInterfaceSchema(schema);
        }
        else {
            return this.protoHelper.parseMappedType(schema) as UnionTypeSchema | IntersectionTypeSchema;
        }
    }

    static async toTSAPI(proto: ServiceProto): Promise<TSAPI> {
        let output: TSAPI = {
            version: '1.0.0',
            servers: ['http://localhost:3000'],
            apis: [],
            // schemas: {}
        };

        // Schema
        // for (let key in proto.types) {
        //     let basename = key.split('/').last()!;
        //     output.schemas[key] = {
        //         ts: await this.toCode(proto.types, key, basename)
        //     }
        // }

        // API
        let apiSvcs = Object.values(ServiceMapUtil.getServiceMap(proto).apiName2Service) as ApiService[];
        for (let api of apiSvcs) {
            let basename = api.name.split('/').last()!;

            let commentArr = proto.types[api.reqSchemaId].comment?.trim()?.split('\n');
            let title = commentArr?.[0].trim();
            let remark = commentArr?.slice(1).join('\n');

            output.apis.push({
                path: '/' + api.name,
                title: title,
                remark: remark,
                req: {
                    ts: await this.toCode(proto.types, api.reqSchemaId, `Req${basename}`),
                },
                res: {
                    ts: await this.toCode(proto.types, api.resSchemaId, `Res${basename}`),
                },
                conf: api.conf
            })
        }

        return output;
    }

    static toMarkdown(api: TSAPI): string {
        let md = `
# TSRPC API 接口文档

## 通用说明

- 所有请求方法均为 \`POST\`
- 所有请求均需加入以下 Header :
    - \`Content-Type: application/json\`

`;
        md += '## 目录\n\n';
        md += this._treeToToc(this._toApiTree(api.apis, '/', 10), 1) + '\n---\n\n';
        md += this._treeToMarkdown(this._toApiTree(api.apis, '/', 3), 1);
        return md;
    }

    private static _treeToToc(tree: ApiTreeNode[], currentDepth: number) {
        let output: string = '';

        // 逐个生成
        for (let node of tree) {
            // 写个标题
            if (node.type === 'api') {
                output += `${' '.repeat((currentDepth - 1) * 4)}- [${node.name}](#${node.api.path})\n`;
            }
            else if (node.type === 'folder') {
                output += `${' '.repeat((currentDepth - 1) * 4)}- ${node.name}\n`;
                output += this._treeToToc(node.children, currentDepth + 1)
            }
        }

        return output;
    }
    private static _treeToMarkdown(tree: ApiTreeNode[], currentDepth: number) {
        let output: string[] = [];

        // 逐个生成
        for (let node of tree) {
            // 写个标题
            let part = `${'#'.repeat(currentDepth + 1)} ${node.name}${node.type === 'api' ? ` <a id="${node.api.path}"></a>` : ''}\n\n`;

            // folder
            if (node.type === 'folder') {
                // 递归
                part += this._treeToMarkdown(node.children, currentDepth + 1);
            }
            // api
            else if (node.type === 'api') {
                // 请求响应……正文内容
                if (node.api.remark) {
                    part += node.api.remark + '\n\n';
                }
                part += `**路径**\n- POST \`${node.api.path}\`\n\n`;
                part += '**请求**\n```ts\n' + node.api.req.ts + '\n```\n\n';
                part += '**响应**\n```ts\n' + node.api.res.ts + '\n```\n\n';
                if (node.api.conf && (typeof node.api.conf !== 'object' || Object.keys(node.api.conf).length > 0)) {
                    part += '**配置**\n```ts\n' + JSON.stringify(node.api.conf, null, 2) + '\n```\n\n';
                }
            }

            output.push(part)
        }

        return output.join('---\n\n');
    }
    private static _toApiTree(apis: TSAPI['apis'], prefix: string, maxDepth: number): ApiTreeNode[] {
        // 按前缀过滤（保护）
        apis = apis.filter(v => v.path.startsWith(prefix));

        let typedApis = apis.map(v => {
            let arrPrefix = prefix.split('/');
            let isLastFolderDepth = arrPrefix.length === maxDepth;
            let groupArr = v.path.slice(prefix.length).split('/');
            let groupName = isLastFolderDepth ? groupArr.slice(0, -1).join('/') : groupArr[0];

            return {
                type: groupArr.length > 1 ? 'folder' : 'api',
                groupName: groupName,
                api: v
            }
        })

        // 计算这一级的 API 节点
        let apiNodes: ApiTreeApiNode[] = typedApis.filter(v => v.type === 'api').map(v => {
            return {
                type: 'api',
                name: v.api.title || v.api.path.split('/').last(),
                api: v.api
            }
        });

        // 整理这一级的 folder 节点
        let folderNodes: ApiTreeFolderNode[] = typedApis.filter(v => v.type === 'folder').groupBy(v => v.groupName)
            .map(v => ({
                type: 'folder',
                name: v.key,
                children: this._toApiTree(v.map(v1 => v1.api), prefix + v.key + '/', maxDepth)
            }));

        // 排序
        return [
            ...folderNodes.orderBy(v => v.name),
            ...apiNodes.orderBy(v => v.api.path)
        ]
    }

    /** 将 TSBufferProto 的 comment 还原为代码注释 */
    private static _toCodeComment(comment: string,) {
        let arr = comment.split('\n');
        if (arr.length === 1) {
            return `/** ${comment} */`;
        }
        else {
            return `/**
${arr.map(v => `* ${v}`).join('\n')}
*/`
        }
    }

}

export interface ApiTreeFolderNode {
    type: 'folder',
    name: string,
    children: ApiTreeNode[]
}
export interface ApiTreeApiNode {
    type: 'api',
    name: string,
    api: TSAPI['apis'][number]
}
export type ApiTreeNode = ApiTreeFolderNode | ApiTreeApiNode;