import * as Express from 'express';
import ApiRequest from './models/ApiRequest';
import ApiResponse from './models/ApiResponse';
import ApiRequestExtend from './middlewares/ApiRequestExtend';
import ServerConfig from './models/ServerConfig';
import 'k8w-extend-native';
import { DefaultServerConfig } from './models/ServerConfig';
import ApiHandler from './models/ApiHandler';
import ApiResponseExtend from './middlewares/ApiResponseExtend';
import ValidatorManager, { IValidator } from 'ts-interface-validator';
import { TsRpcPtl, TsRpcReq, TsRpcRes, TsRpcError } from 'tsrpc-protocol';
import * as http from 'http';
import AutoImplementProtocol from './models/AutoImplementProtocol';
import EnableLog4js from './models/EnableLog4js';
const bodyParser = require('body-parser');

export type RouterHandler = (req: ApiRequest<any>, res: ApiResponse<any>, next: Function) => void;

export default class RpcServer {
    readonly config: ServerConfig;

    constructor(conf: Partial<ServerConfig> & { protocolPath: string }) {
        this.config = Object.merge({}, DefaultServerConfig, conf);

        //Enable log4js
        if (this.config.logFiles) {
            EnableLog4js(this.config.logFiles);
        }

        //auto implement protocol
        if (this.config.autoImplement) {
            if (!this.config.apiPath) {
                throw new Error('Must set apiPath when autoImplement is enabled')
            }

            console.log('Start auto implement protocol...');
            let result = AutoImplementProtocol(this, this.config.protocolPath, this.config.apiPath);
            if (result == null) {
                console.log('√ Auto implement protocol succ')
            }
            else {
                throw new Error('× Auto implement protocol failed:\n' + result.map((v, i) => `    ${i + 1}. ` + v).join('\n'))
            }
        }
    }

    protected _implementedUrl: {
        [rpcUrl: string]: {
            protocol: TsRpcPtl<any, any>,
            handler: ApiHandler<any, any>,
            reqValidator: IValidator
        }
    } = {};
    /**
     * Implement PtlXXX by ApiXXX
     * @param protocol PtlXXX
     * @param handler ApiXXX
     */
    implementPtl<Req, Res>(protocol: TsRpcPtl<Req, Res>, handler: ApiHandler<Req, Res>) {
        let url = this.getPtlUrl(protocol);
        //duplicate warn
        if (this._implementedUrl[url]) {
            console.warn('You are implementing a duplicated protocol: ' + protocol.filename, 'url=' + url);
        }
        //get request validator
        let reqValidator = ValidatorManager.instance.getValidator('Req' + protocol.name, protocol.filename.replace(/\.js$/, '.ts'));
        //do register
        this._implementedUrl[url] = {
            protocol: protocol,
            handler: handler,
            reqValidator: reqValidator
        }
    }

    /**
     * Get rpcUrl of protocol
     * Without `/` at the beginning and the end
     * @param ptl 
     */
    private getPtlUrl(ptl: TsRpcPtl<any, any>): string {
        let filename = ptl.filename.replace(/\.js$/, '.ts');
        if (!filename.startsWith(this.config.protocolPath) || !filename.endsWith('.ts')) {
            throw new Error('Protocol is not in the protocolPath : ' + filename);
        }
        return filename.substr(this.config.protocolPath.length, filename.length - this.config.protocolPath.length - 3)  // /root/a/b/PtlC.ts -> /a/b/PtlC
            .replace(/\\/g, '/').replace(/Ptl(\w+)$/, '$1'); // /a/b/PtlC -> /a/b/C
    }

    private _expressApp: Express.Application;
    private init() {
        if (this._expressApp) {
            return;
        }

        //new express app
        let expressApp: Express.Application = Express();
        this._expressApp = expressApp;

        //the frontest init
        //optimize useless header
        expressApp.disable('x-powered-by');
        //parse body
        expressApp.use(bodyParser[this.config.binaryTransport ? 'raw' : 'text']({ limit: Infinity, type: () => true }))
        //extend rpcServer for req and res
        expressApp.use((req: ApiRequest<any>, res: ApiResponse<any>, next) => {
            req.rpcServer = this;
            res.rpcServer = this;
            next();
        });

        //Req extend
        expressApp.use(ApiRequestExtend);
        //Res extend
        expressApp.use(ApiResponseExtend);
        //Check if protocol registered
        expressApp.use((req: ApiRequest<TsRpcReq>, res: ApiResponse<TsRpcRes>, next) => {
            if (this.config.hideApiPath) {
                //__tsrpc_url__ should appear
                if (req.args.__tsrpc_url__ == null) {
                    res.error('HideApiPath is enabled, set it to true too in your client config.', 'REQ_CANT_BE_RESOLVED')
                    return;
                }
                req.rpcUrl = req.args.__tsrpc_url__;
            }
            else {
                //__tsrpc_url__ should not appear
                if (req.args.__tsrpc_url__) {
                    res.error('HideApiPath is disabled, set it to false too in your client config.', 'REQ_CANT_BE_RESOLVED')
                    return;
                }
                req.rpcUrl = req.path;
            }

            //Not specify rpcUrl
            if (!req.rpcUrl) {
                res.error('Request cannot be resolved', 'REQ_CANT_BE_RESOLVED')
                return;
            }

            //404
            if (!this._implementedUrl[req.rpcUrl]) {
                //Error404: no url or protocol not registered
                this.onPtlNotFound(req, res);
                return;
            }

            //OK: Protocol registered
            req.rpcPtl = this._implementedUrl[req.path].protocol;
            next();
        });

        //_routerBeforeApiHandler
        expressApp.use(this._routerBeforeApiHandler);

        //api handler (final router)
        expressApp.use(async (req: ApiRequest<any>, res: ApiResponse<any>) => {
            //log request
            console.log('[ApiReq]', '#' + req.reqId, req.rpcUrl, this.config.logRequestDetail ? req.args : '');

            //validate request
            let validateResult = this._implementedUrl[req.path].reqValidator.validate(req.args);
            if (validateResult.isError) {
                let originalError = validateResult.originalError;
                let reason = this.config.showParamInvalidReason ? (originalError.fieldName + ': ' + originalError.message) : 'Invalid Request Parameter';
                console.warn('Invalid Request Parameter', req.rpcUrl, originalError.fieldName + ': ' + originalError.message);
                res.error(reason, 'INVALID_REQ_PARAM');
                return;
            }

            //do handler
            try {
                let result = await this._implementedUrl[req.path].handler(req, res);
            }
            catch (e) {
                //TsRpcError is return to client directly
                if (e instanceof TsRpcError) {
                    res.error(e.message, e.info);
                }
                else {
                    this.onUnhandledApiError(e, req, res);
                }
            }

            //log response
            if (res.rpcOutput) {
                if (res.rpcOutput.errmsg == null) {
                    //ApiRes
                    console.log('[ApiRes]', '#' + req.reqId, this.config.logResponseDetail ? res.rpcOutput : '');
                }
                else {
                    //error
                    console.error('[ApiErr]', '#' + req.reqId, res.rpcOutput);
                }
            }

            //complete event (succ or error)
            this.onApiComplete && this.onApiComplete(req, res);
        })

        console.log('√ TSRPC inited succ')
    }

    private _server: http.Server;
    async start(port?: number) {
        this.init();
        port = port || this.config.defaultPort;

        return new Promise<void>((rs, rj) => {
            try {
                this._server = this._expressApp.listen(port, () => {
                    console.log(`√ Server started at ${port}...`)
                    rs();
                });
            }
            catch (e) {
                rj(`× Port ${port} is already in use.`)
            }

        })
    }

    stop() {
        this._server && this._server.close()
        delete this._server;
    }

    //get、post、use it will use before api handler
    private _routerBeforeApiHandler = Express.Router();
    use(handler: RouterHandler): void;
    use(path: string, handler: RouterHandler): void;
    use() {
        this._routerBeforeApiHandler.use.apply(this._routerBeforeApiHandler, arguments);
    }
    get(handler: RouterHandler): void;
    get(path: string, handler: RouterHandler): void;
    get() {
        this._routerBeforeApiHandler.get.apply(this._routerBeforeApiHandler, arguments);
    }
    post(handler: RouterHandler): void;
    post(path: string, handler: RouterHandler): void;
    post() {
        this._routerBeforeApiHandler.post.apply(this._routerBeforeApiHandler, arguments);
    }

    //hooks
    onPtlNotFound(req: ApiRequest<any>, res: ApiResponse<any>) {
        res.status(404);
        res.error('404 Not Found', 'PTL_NOT_FOUND');
    };
    onUnhandledApiError(err: Error, req: ApiRequest<any>, res: ApiResponse<any>) {
        console.error(req.rpcUrl, req.args, err);
        res.error('Internal Server Error', 'UNHANDLED_API_ERROR');
    };
    onApiComplete?: (req: ApiRequest<any>, output: ApiResponse<any>) => {};
}