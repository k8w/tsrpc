import { ApiHandler, AutoImplementApiReturn, BaseConnection, BaseConnectionApiHandlers } from "../base/BaseConnection";
import { ApiServiceDef } from "../proto/ServiceProto";
import { OpResult } from "./OpResult";

export class ApiHandlerUtil {

    /**
     * Associate a `ApiHandler` to a specific `apiName`.
     * So that when `ApiCall` is receiving, it can be handled correctly.
     * @param apiName
     * @param handler
     */
    static implementApi(host: ApiHandlerHost, apiHandlers: BaseConnectionApiHandlers, apiName: string, handler: ApiHandler): void {
        if (apiHandlers[apiName as string]) {
            throw new Error(`Cannot implement API '${apiName}' duplicately.`);
        }
        apiHandlers[apiName as string] = handler;
        host.logger.log(`Implemented API ${host.chalk(apiName, ['underline'])} successfully.`);
    };

    static async autoImplementApi(host: ApiHandlerHost, apiHandlers: BaseConnectionApiHandlers, dirOrName: string, dirOrDelay?: string | boolean | number, delay?: boolean | number): Promise<AutoImplementApiReturn> {
        // Currying arguments
        const apiDir = typeof dirOrDelay === 'string' ? dirOrDelay : dirOrName;
        const apiName = typeof dirOrDelay === 'string' ? dirOrName : '*';
        delay = typeof dirOrDelay === 'string' ? delay : dirOrDelay;

        host.logger.debug(`Start autoImplementApi '${apiName}' to '${apiDir}'${(delay ? ' (delay)' : '')}...`);

        const apiServices = Object.values(host.serviceMap.name2LocalApi) as ApiServiceDef[];
        const output = { succ: [], fail: [], delay: [] } as Awaited<ReturnType<typeof ApiHandlerUtil['autoImplementApi']>>;

        let index = 0;
        for (let service of apiServices) {
            ++index;
            const apiName = service.name;
            const loadHandler = () => {
                let promise = this._loadApiHandler(host, apiName, apiDir);
                promise.then(v => {
                    if (!v.isSucc) {
                        host.logger.error(`Failed to load handler of API '${apiName}'. ${v.errMsg}`);
                    }
                })
                return promise;
            }

            // Delay
            if (delay) {
                ApiHandlerUtil._implementApiDelay(host, apiHandlers, apiName, loadHandler, typeof delay === 'number' ? delay : undefined);
                output.delay.push(apiName);
                host.logger.log(`[${index}/${apiServices.length}] ${host.chalk(apiName, ['debug', 'underline'])} ${host.chalk('delayed', ['gray'])}`)
                continue;
            }

            // Immediately
            const op = await loadHandler();
            if (op.isSucc) {
                apiHandlers[apiName] = op.res;
                output.succ.push(apiName);
            }
            else {
                output.fail.push({ apiName, errMsg: op.errMsg });
            }
            host.logger.log(`[${index}/${apiServices.length}] ${host.chalk(apiName, ['debug', 'underline'])} ${op.isSucc ? host.chalk('succ', ['info']) : host.chalk('failed', ['error'])}`)
        }

        // Final result log
        host.logger.log('Finished autoImplementApi: ' + (delay ?
            `delay ${output.delay.length}/${apiServices.length}.` :
            `succ ${host.chalk(`${output.succ}/${apiServices.length}`, [output.fail.length ? 'warn' : 'info'])}, failed ${host.chalk('' + output.fail.length, output.fail.length ? ['error', 'bold'] : ['normal'])}.`
        ));

        return output;
    }

    protected static _implementApiDelay(host: ApiHandlerHost, apiHandlers: BaseConnectionApiHandlers, apiName: string, loadHandler: () => Promise<OpResult<ApiHandler>>, maxDelayTime?: number): void {
        // Delay get handler
        let promiseHandler: Promise<OpResult<ApiHandler>> | undefined;
        const doGetHandler = () => {
            if (promiseHandler) {
                return promiseHandler;
            }

            promiseHandler = loadHandler();
            // 获取成功后重新 implement 为真实 API
            promiseHandler.then(op => {
                apiHandlers[apiName] = undefined;
                if (op.isSucc) {
                    this.implementApi(host, apiHandlers, apiName, op.res);
                }
            })

            return promiseHandler;
        }

        if (maxDelayTime) {
            setTimeout(() => { doGetHandler() }, maxDelayTime);
        }

        // Implement as a delay wrapper
        const delayHandler: ApiHandler = call => {
            return doGetHandler().then(op => {
                if (!op.isSucc) {
                    call['_errorNotImplemented']();
                    return;
                }
                op.res(call)
            })
        }
        apiHandlers[apiName as string] = delayHandler;
    }

    protected static async _loadApiHandler(host: ApiHandlerHost, apiName: string, apiDir: string): Promise<OpResult<ApiHandler>> {
        // get api last name
        const match = apiName.match(/^\/?(.+\/)*(.+)$/);
        if (!match) {
            return { isSucc: false, errMsg: `Invalid api name: '${apiName}'` };
        }
        const handlerPath = match[1] ?? '';
        const handlerName = match[2];

        // try import
        apiDir = apiDir.replace(/\\/g, '/');
        const modulePath = apiDir + (apiDir.endsWith('/') ? '' : '/') + handlerPath + '/Api' + handlerName;
        try {
            var module = await import(modulePath);
        }
        catch (e: unknown) {
            if ((e as any).code === 'ERR_MODULE_NOT_FOUND' || (e as any).code === 'MODULE_NOT_FOUND') {
                return { isSucc: false, errMsg: (e as Error).message };
            }
            return { isSucc: false, errMsg: host.chalk(`Import module '${host.chalk(modulePath, ['underline'])}' failed. `, ['error']) + (e as Error).stack ?? (e as Error).message };
        }

        // 优先 default，其次 ApiName 同名
        let handler = module.default ?? module['Api' + handlerName];
        if (handler) {
            return { isSucc: true, res: handler };
        }
        else {
            let similarMember = Object.keys(module).find(v => /Api\w+/.test(v));
            return {
                isSucc: false,
                errMsg: `Missing 'export Api${handlerName}' or 'export default' in: ${modulePath}` +
                    (similarMember ? host.chalk(`\n\tYou may rename '${similarMember}' to 'Api${handlerName}'`, ['debug']) : '')
            }
        }
    }
}

export type ApiHandlerHost = Pick<BaseConnection, 'logger' | 'serviceMap' | 'chalk'>;