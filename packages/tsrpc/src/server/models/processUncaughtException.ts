import { Logger } from "tsrpc-base";

let isUncaughtExceptionProcessed = false;
export function processUncaughtException(logger: Logger) {
    if (isUncaughtExceptionProcessed) {
        return;
    }
    isUncaughtExceptionProcessed = true;

    process.on('uncaughtException', e => {
        logger.error('[uncaughtException]', e);
    });

    process.on('unhandledRejection', e => {
        logger.error('[unhandledRejection]', e);
    });
}