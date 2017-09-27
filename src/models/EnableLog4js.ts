import ServerConfig from './ServerConfig';
import MkdirPSync from './MkdirPSync';
import * as path from 'path';
import * as uuid from 'uuid';
const log4js = require('log4js');

/**
 * Configure log4js and replace native console
 * @param logFiles 
 */
export default function EnableLog4js(logFiles: ServerConfig['logFiles']) {
    let instanceId = '<' + uuid().substr(-4) + '>';

    //stdout & stderr
    let appenders: any = [
        {
            type: 'logLevelFilter',
            level: 'trace',
            maxLevel: 'info',
            appender: { type: 'stdout' },
            category: instanceId
        },
        {
            type: 'logLevelFilter',
            level: 'warn',
            appender: { type: 'stderr' },
            category: instanceId
        }
    ]

    logFiles && logFiles.forEach((logFile, i) => {
        //mkdir -p
        MkdirPSync(logFile.path);

        //appender
        appenders.push({
            type: 'logLevelFilter',
            level: logFile.level,
            appender: {
                type: 'dateFile',
                filename: path.resolve(logFile.path, logFile.filename),
                daysToKeep: logFile.keepDays,
                pattern: '-yyyyMMdd',
                alwaysIncludePattern: true
            },
            category: instanceId
        })
    })

    log4js.configure({
        appenders: appenders
    });

    //replace console
    let logger = log4js.getLogger(instanceId);
    console.debug = logger.debug.bind(logger);
    console.log = logger.info.bind(logger);
    console.info = logger.info.bind(logger);
    console.warn = logger.warn.bind(logger);
    console.error = logger.error.bind(logger);
}