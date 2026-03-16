const { createLogger, format, transports } = require('winston');
const { combine, timestamp, errors, json, colorize, printf } = format;

const isDev = process.env.NODE_ENV !== 'production';

const devFormat = combine(
    colorize(),
    timestamp({ format: 'HH:mm:ss' }),
    errors({ stack: true }),
    printf(({ level, message, timestamp, correlationId, ...meta }) => {
        const cid = correlationId ? ` [${correlationId.substring(0, 8)}]` : '';
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp}${cid} ${level}: ${message}${metaStr}`;
    })
);

const prodFormat = combine(
    timestamp(),
    errors({ stack: true }),
    json()
);

const logger = createLogger({
    level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
    format: isDev ? devFormat : prodFormat,
    defaultMeta: { service: 'voiceagent' },
    transports: [
        new transports.Console(),
    ],
    exceptionHandlers: [
        new transports.Console(),
    ],
    rejectionHandlers: [
        new transports.Console(),
    ],
});

/**
 * Returns a child logger with a bound correlationId so every log line carries it.
 */
logger.withCorrelation = function (correlationId) {
    return logger.child({ correlationId });
};

module.exports = logger;
