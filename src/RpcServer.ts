import * as Express from 'express';
import ApiRequest from './models/ApiRequest';
import ApiResponse from './models/ApiResponse';
import ApiRequestExtend from './middlewares/ApiRequestExtend';
import ServerConfig from './models/ServerConfig';
import 'k8w-extend-native';
import { defaultServerConfig } from './models/ServerConfig';
import ApiHandler from './models/ApiHandler';
import ApiResponseExtend from './middlewares/ApiResponseExtend';
import ValidatorManager, { IValidator } from 'ts-interface-validator';
import { TsRpcPtl, TsRpcReq, TsRpcRes } from 'tsrpc-protocol';
import * as http from 'http';

export type RouterHandler = (req: ApiRequest<any>, res: ApiResponse<any>, next?: Function) => void;

export default class RpcServer {
    readonly config: ServerConfig;
    constructor(conf: Partial<ServerConfig> & { protocolPath: string }) {
        if (conf.autoImplement && !conf.apiPath) {
            throw new Error('apiPath must be given when autoImplement is true')
        }
        this.config = Object.merge({}, defaultServerConfig, conf);
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
        let reqValidator = ValidatorManager.instance.getValidator('Req' + protocol.name, protocol.filename);
        //do register
        this._implementedUrl[url] = {
            protocol: protocol,
            handler: handler,
            reqValidator: reqValidator
        }
    }

    /**
     * Get url of protocol which is passed in url or request body
     * Without `/` at the beginning and the end
     * @param ptl 
     */
    private getPtlUrl(ptl: TsRpcPtl<any, any>): string {
        let filename = ptl.filename.replace(/\.js$/, '.ts');
        if (!filename.startsWith(this.config.protocolPath) || !filename.endsWith('.ts')) {
            throw new Error('Error protocol filename (not in the protocolPath) : ' + filename);
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
        //parse all type as text
        expressApp.use(require('body-parser').text({ limit: Infinity, type: () => true }));
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

        //preUsedRouterHandlers
        for (let handler of this._preUsedRouterHandlers) {
            expressApp.use(handler);
        }

        //api handler
        expressApp.use((req: ApiRequest<any>, res: ApiResponse<any>, next) => {
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
                let result = this._implementedUrl[req.path].handler(req, res);
                if (result instanceof Promise) {
                    result.catch(e => {
                        this.onUnhandledApiError(e, req, res);
                    })
                }
            }
            catch (e) {
                this.onUnhandledApiError(e, req, res);
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

        console.log('TSRPC inited succ.')
    }

    private _server: http.Server;
    start(port?: number) {
        this.init();
        port = port || this.config.defaultPort;
        this._server = this._expressApp.listen(port);
        this._server.listening ? console.log(`Server started at ${port}...`) : console.error(`Port ${port} is already in use.`);
    }

    stop() {
        this._server && this._server.close()
        delete this._server;
    }

    private _preUsedRouterHandlers: RouterHandler[] = [];
    use(routerHandler: RouterHandler) {
        //一经init 不能再use
        if (this._expressApp) {
            throw new Error('Can only call use before server start.')
        }
        this._preUsedRouterHandlers.push(routerHandler);
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