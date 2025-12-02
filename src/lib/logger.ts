/**
 * Structured logging utility for Logoz Cloud Print Studio
 *
 * Provides consistent logging across the application with:
 * - Structured JSON output in production
 * - Pretty console output in development
 * - Context-aware child loggers
 * - Request ID tracking
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

type LogEntry = {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
};

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isProduction = process.env.NODE_ENV === 'production';
const configuredLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const minLevel = LOG_LEVELS[configuredLevel] ?? LOG_LEVELS.info;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= minLevel;
}

function formatForProduction(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function formatForDevelopment(entry: LogEntry): string {
  const levelColors: Record<LogLevel, string> = {
    debug: '\x1b[90m', // Gray
    info: '\x1b[36m', // Cyan
    warn: '\x1b[33m', // Yellow
    error: '\x1b[31m', // Red
  };
  const reset = '\x1b[0m';
  const color = levelColors[entry.level];

  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
  });

  let output = `${color}[${time}] ${entry.level.toUpperCase()}${reset}: ${entry.message}`;

  if (entry.context && Object.keys(entry.context).length > 0) {
    output += `\n  ${JSON.stringify(entry.context, null, 2).replace(/\n/g, '\n  ')}`;
  }

  return output;
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  };

  const formatted = isProduction
    ? formatForProduction(entry)
    : formatForDevelopment(entry);

  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'debug':
      console.debug(formatted);
      break;
    default:
      console.log(formatted);
  }
}

/**
 * Main logger instance
 */
export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context),

  /**
   * Create a child logger with preset context
   */
  child: (baseContext: LogContext) => ({
    debug: (message: string, context?: LogContext) =>
      log('debug', message, { ...baseContext, ...context }),
    info: (message: string, context?: LogContext) =>
      log('info', message, { ...baseContext, ...context }),
    warn: (message: string, context?: LogContext) =>
      log('warn', message, { ...baseContext, ...context }),
    error: (message: string, context?: LogContext) =>
      log('error', message, { ...baseContext, ...context }),
  }),
};

/**
 * Pre-configured loggers for different contexts
 */
export const apiLogger = logger.child({ context: 'api' });
export const dbLogger = logger.child({ context: 'database' });
export const authLogger = logger.child({ context: 'auth' });
export const adminLogger = logger.child({ context: 'admin' });

/**
 * Create a request-scoped logger with unique request ID
 */
export function createRequestLogger(request: Request) {
  const requestId = crypto.randomUUID();
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  return logger.child({
    requestId,
    ip,
    method: request.method,
    path: new URL(request.url).pathname,
  });
}

/**
 * Log performance timing
 */
export function logTiming(
  label: string,
  startTime: number,
  context?: LogContext
): void {
  const duration = Date.now() - startTime;
  logger.debug(`${label} completed`, {
    ...context,
    durationMs: duration,
  });
}

/**
 * Create a timer for performance logging
 */
export function createTimer(label: string) {
  const startTime = Date.now();
  return {
    end: (context?: LogContext) => logTiming(label, startTime, context),
    elapsed: () => Date.now() - startTime,
  };
}
