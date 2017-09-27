import ServerConfig from './ServerConfig';
import MkdirPSync from './MkdirPSync';
import * as path from 'path';
const log4js = require('log4js');

/**
 * Configure log4js and replace native console
 * @param logFiles 
 */
export default function EnableLog4js(logFiles: ServerConfig['logFiles']) {
    //stdout & stderr
    let appenders: any = {
        stdout_out: { type: 'stdout' },
        stdout: {
            type: 'logLevelFilter',
            level: 'trace',
            maxLevel: 'info',
            appender: 'stdout_out'
        },
        stderr_out: { type: 'stderr' },
        stderr: {
            type: 'logLevelFilter',
            level: 'warn',
            appender: 'stderr_out'
        }
    }
    
    logFiles && logFiles.forEach((logFile, i) => {
        //mkdir -p
        MkdirPSync(logFile.path);

        //appender
        appenders['logFile_out_' + i] = {
            type: 'dateFile',
            filename: path.resolve(logFile.path, logFile.filename),
            daysToKeep: logFile.keepDays,
            pattern: '-yyyyMMdd',
            alwaysIncludePattern: true
        }
        appenders['logFile_' + i] = {
            type: 'logLevelFilter',
            level: logFile.level,
            appender: 'logFile_out_' + i
        }
    })

    log4js.configure({
        appenders: appenders,
        categories: {
            default: {
                appenders: (logFiles ? logFiles.map((v, i) => 'logFile_' + i) : []).concat('stdout', 'stderr'),
                level: 'trace'
            }
        },
        pm2: true
    });

    //replace console
    let logger = log4js.getLogger();
    console.trace = logger.trace.bind(logger);
    console.debug = logger.debug.bind(logger);
    console.log = logger.info.bind(logger);
    console.info = logger.info.bind(logger);
    console.warn = logger.warn.bind(logger);
    console.error = logger.error.bind(logger);
}