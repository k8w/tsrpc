import * as Express from 'express';
import ApiRequest from './models/ApiRequest';
import ApiResponse from './models/ApiResponse';
import ApiRequestExtend from './middlewares/ApiRequestExtend';
import ServerConfig from './models/ServerConfig';
import 'k8w-extend-native';
import { defaultServerConfig } from './models/ServerConfig';
import Protocol from './models/Protocol';
import ApiHandler from './models/ApiHandler';
import ApiResponseExtend from './middlewares/ApiResponseExtend';
import TsInterfaceValidator, { IValidator } from 'ts-interface-validator';
import Request from './models/Request';
import Response from './models/Response';

export default class RpcServer {
    readonly conf: ServerConfig;
    constructor(conf: Partial<ServerConfig> & {
        protocolPath: string;
    }) {
        if (conf.autoImplement && !conf.apiPath) {
            throw new Error('apiPath must be given when autoImplement is true')
        }
        this.conf = Object.merge({}, defaultServerConfig, conf);
    }

    protected _implementedUrl: {
        [tsrpcUrl: string]: {
            protocol: Protocol<any, any>,
            handler: ApiHandler<any, any>,
            reqValidator: IValidator
        }
    } = {};
    /**
     * Implement PtlXXX by ApiXXX
     * @param protocol PtlXXX
     * @param handler ApiXXX
     */
    implementPtl<Req, Res>(protocol: Protocol<Req, Res>, handler: ApiHandler<Req, Res>) {
        let url = this.getPtlUrl(protocol);
        //duplicate warn
        if (this._implementedUrl[url]) {
            console.warn('You are implementing a duplicated protocol: ' + protocol.filename, 'url=' + url);
        }
        //get request validator
        let reqValidator = TsInterfaceValidator.getInterfaceValidator(protocol.filename, 'Req' + protocol.name);
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
    private getPtlUrl(ptl: Protocol<any, any>): string {
        let filename = ptl.filename.replace(/\.js$/, '.ts');
        if (!filename.startsWith(this.conf.protocolPath) || !filename.endsWith('.ts')) {
            throw new Error('Error protocol filename (not in the protocolPath) : ' + filename);
        }
        return filename.substr(this.conf.protocolPath.length + 1, filename.length - this.conf.protocolPath.length - 4)  // /root/a/b/PtlC -> a/b/PtlC
            .replace(/\\/g, '/').replace(/\/Ptl(\w+)$/, '/$1'); // a/b/PtlC -> a/b/C
    }

    start(port?: number) {
        //new express app
        let expressApp: Express.Application = Express();

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
        //Check if protocol registered
        expressApp.use((req: ApiRequest<Request>, res: ApiResponse<Response>, next) => {
            req.rpcUrl = this.conf.hideApiPath ? (req.args.__tsrpc_url__ || '') : req.path;
            if (!req.rpcUrl || !this._implementedUrl[req.rpcUrl]) {
                //Error404: no url or protocol not registered
                this.onPtlNotFound(req, res);
                return;
            }
            //Protocol registered
            req.rpcPtl = this._implementedUrl[req.path].protocol;
            next();
        });
        //Res extend
        expressApp.use(ApiResponseExtend);

        //beforeUseApi
        if (this.beforeUseApi) {
            this.beforeUseApi(expressApp);
        }
        //handleApi
        expressApp.use((req: ApiRequest<any>, res: ApiResponse<any>, next) => {
            //validate request
            let validateResult = this._implementedUrl[req.path].reqValidator.validate(req.args);
            if (validateResult.isError) {
                let originalError = validateResult.originalError;
                console.warn('Invalid request parameter', req.rpcUrl, originalError.fieldName, originalError.message);
                res.error(originalError.fieldName + ': ' + originalError.message);
                return;
            }

            //do handler
            try {
                let result = this._implementedUrl[req.path].handler(req, res);
                if (result instanceof Promise) {
                    result.catch(e => {
                        this.onUnhandledApiError(req, res, e);
                    })
                }
            }
            catch (e) {
                this.onUnhandledApiError(req, res, e);
            }
            
            //complete event (succ or error)
            if (this.onApiComplete) {
                this.onApiComplete(req, res);
            }
        })
    }

    //hooks
    onPtlNotFound(req: ApiRequest<any>, res: ApiResponse<any>) {
        res.status(404);
        res.error('404 Not Found');
    };
    onUnhandledApiError(req: ApiRequest<any>, res: ApiResponse<any>, err: Error) {
        console.error(req.rpcUrl, req.args, err);
        res.error('Internal Server Error');
    };
    beforeUseApi?: (expressApp: Express.Application) => {};
    onApiComplete?: (req: ApiRequest<any>, output: ApiResponse<any>) => {};
}