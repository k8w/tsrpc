export class HandlersObjUtil {

    static addHandler(obj: HandlersObj, key: string, handler: Function) {
        let handlers = obj[key];
        // 初始化Handlers
        if (!handlers) {
            handlers = obj[key] = [];
        }
        // 防止重复监听
        else if (handlers.some(v => v === handler)) {
            return;
        }

        handlers.push(handler);
    };

    static removeHandler(obj: HandlersObj, key: string, handler?: Function) {
        let handlers = obj[key];
        if (!handlers) {
            return;
        }

        // 未指定handler，删除所有handler
        if (!handler) {
            delete obj[key];
            return;
        }

        handlers.removeOne(v => v === handler);
    };

}

export type HandlersObj = { [key: string]: Function[] | undefined };