var winston = require('winston');
var config = require('./config');

var wlogger = winston.createLogger({
    level: config.getConfig().logLevel || 'info',
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        verbose: 3,
        debug: 4,
        silly: 5,
    },
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(info => `${info.timestamp} [${info.level}]: ${info.message}`),
    ),
    exceptionHandlers: [
        new winston.transports.File({ filename: 'logs/exceptions.log' }),
    ],
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/info.log', level: 'info' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
    ],
    exitOnError: false,
}).on('error', (e) => {
    console.log(`[winston!err] ${e.stack}`);
});

if (process.env.NODE_ENV !== 'production') {
    wlogger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            winston.format.printf(info => `${info.timestamp} [${info.level}]: ${info.message}`),
        ),
    }));
}

module.exports = wlogger;