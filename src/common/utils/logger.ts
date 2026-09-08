type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const resolveLogLevel = (): LogLevel => {
  const level = process.env.LOG_LEVEL;

  if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
    return level;
  }

  return 'info';
};

const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const shouldLog = (level: LogLevel): boolean => {
  return levelPriority[level] >= levelPriority[resolveLogLevel()];
};

const writeLog = (level: LogLevel, message: string, meta?: Record<string, unknown>): void => {
  if (!shouldLog(level)) {
    return;
  }

  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  const output = JSON.stringify(entry);

  if (level === 'error') {
    console.error(output);
    return;
  }

  if (level === 'warn') {
    console.warn(output);
    return;
  }

  console.log(output);
};

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => writeLog('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => writeLog('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => writeLog('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => writeLog('error', message, meta),
};
