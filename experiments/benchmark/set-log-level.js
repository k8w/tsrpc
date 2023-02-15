const empty = () => {};
function setLogLevel1(logger, logLevel) {
  switch (logLevel) {
    case 'none':
      return { debug: empty, log: empty, warn: empty, error: empty };
    case 'error':
      return {
        debug: empty,
        log: empty,
        warn: empty,
        error: logger.error.bind(logger),
      };
    case 'warn':
      return {
        debug: empty,
        log: empty,
        warn: logger.warn.bind(logger),
        error: logger.error.bind(logger),
      };
    case 'info':
      return {
        debug: empty,
        log: logger.log.bind(logger),
        warn: logger.warn.bind(logger),
        error: logger.error.bind(logger),
      };
    case 'debug':
      return logger;
    default:
      throw new Error('Invalid logLevel: ' + logLevel);
  }
}

const loggerFunNames = ['debug', 'log', 'warn', 'error'];
function setLogLevel2(logger, logLevel) {
  const levelIndex =
    logLevel === 'none'
      ? 99
      : loggerFunNames.indexOf(logLevel === 'info' ? 'log' : logLevel);

  // New logger
  let output = {};
  loggerFunNames.forEach((v, i) => {
    output[v] = i >= levelIndex ? logger[v].bind(logger) : empty;
  });
  return output;
}

for (let i = 0; i < 10; ++i) {
  console.time('inline');
  for (let i = 0; i < 100000; ++i) {
    // setLogLevel1(console, 'debug');
    // setLogLevel1(console, 'info');
    setLogLevel1(console, 'warn');
    // setLogLevel1(console, 'error');
    // setLogLevel1(console, 'none');
  }
  console.timeEnd('inline');

  console.time('loop');
  for (let i = 0; i < 100000; ++i) {
    // setLogLevel2(console, 'debug');
    // setLogLevel2(console, 'info');
    setLogLevel2(console, 'warn');
    // setLogLevel2(console, 'error');
    // setLogLevel2(console, 'none');
  }
  console.timeEnd('loop');
}
