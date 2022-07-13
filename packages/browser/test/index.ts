import 'es6-shim';
import { Logger } from '../src';
import { kunit as httpCase } from "./http.test";
import { kunit as httpJsonCase } from "./httpJSON.test";
import { kunit as wsCase } from "./ws.test";
import { kunit as wsJsonCase } from "./wsJSON.test";

function getLogger(originalLogger: Logger, element: HTMLElement, prefix: string) {
    let logger = (['debug', 'log', 'warn', 'error'] as const).reduce((prev, next) => {
        prev[next] = function (...args: any[]) {
            originalLogger[next](prefix, ...args);
            let node = document.createElement(next);
            node.innerText = args.map(v => v).join(' ');
            element.appendChild(node);
            window.scrollTo(0, 99999);
        }
        return prev;
    }, {} as Logger);
    return logger;
}

async function main() {
    (window as any).atob = null;
    (window as any).btoa = null;

    httpCase.logger = getLogger(httpCase.logger, document.getElementById('http')!, '[HTTP]')
    await httpCase.runAll();
    document.querySelector('#http>h2>small')?.remove?.();

    httpJsonCase.logger = getLogger(httpJsonCase.logger, document.getElementById('httpJSON')!, '[HTTP JSON]')
    await httpJsonCase.runAll();
    document.querySelector('#httpJSON>h2>small')?.remove?.();

    wsCase.logger = getLogger(wsCase.logger, document.getElementById('ws')!, '[WS]')
    await wsCase.runAll();
    document.querySelector('#ws>h2>small')?.remove?.();

    wsJsonCase.logger = getLogger(wsJsonCase.logger, document.getElementById('wsJSON')!, '[WS JSON]')
    await wsJsonCase.runAll();
    document.querySelector('#wsJSON>h2>small')?.remove?.();

}
main();