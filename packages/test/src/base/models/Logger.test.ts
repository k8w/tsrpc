import assert from 'assert';
import { Logger, LogLevel, setLogLevel } from 'tsrpc-base';

function test(logLevel: LogLevel) {
  const result: [number, number, number, number] = [0, 0, 0, 0];
  let logger: Logger = {
    debug: () => {
      ++result[0];
    },
    info: () => {
      ++result[1];
    },
    warn: () => {
      ++result[2];
    },
    error: () => {
      ++result[3];
    },
  };
  logger = setLogLevel(logger, logLevel);
  logger.debug('aaa');
  logger.info('aaa');
  logger.warn('aaa');
  logger.error('aaa');
  return result;
}

describe('Logger', function () {
  it('debug', function () {
    assert.deepStrictEqual(test('debug'), [1, 1, 1, 1]);
  });

  it('info', function () {
    assert.deepStrictEqual(test('info'), [0, 1, 1, 1]);
  });

  it('warn', function () {
    assert.deepStrictEqual(test('warn'), [0, 0, 1, 1]);
  });

  it('error', function () {
    assert.deepStrictEqual(test('error'), [0, 0, 0, 1]);
  });

  it('none', function () {
    assert.deepStrictEqual(test('none'), [0, 0, 0, 0]);
  });

  it('throws', function () {
    assert.throws(() => {
      test('xxx' as any);
    });
  });
});
