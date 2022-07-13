import {assert} from 'chai';
import { Logger, setLogLevel } from './Logger';

describe('Logger', function () {
    it('setLogLevel', function () {
        let num = 0;
        let logger: Logger = {
            debug: () => { ++num },
            log: () => { ++num },
            warn: () => { ++num },
            error: () => { ++num },
        };
        setLogLevel(logger, 'warn');

        logger.debug('aaa');
        logger.log();
        assert.strictEqual(num, 0);

        logger.warn();
        assert.strictEqual(num, 1);
        
        logger.error();
        assert.strictEqual(num, 2);
    })
});