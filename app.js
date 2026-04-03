#!/usr/bin/node

require('dotenv').config();

const loggerManager = require('./logger-manager');

function getLogLevel(){
    const DEFAULT_LOG_LEVEL = loggerManager.LOG_LEVELS.INFO;
    const CLI_KEY = '--log-level=';

    for (let arg of process.argv){
        if (arg.startsWith(CLI_KEY)){
            let level = arg.substring(CLI_KEY.length).toLowerCase();
            switch (level) {
                case 'critical':
                    return loggerManager.LOG_LEVELS.CRITICAL;
                case 'error':
                    return loggerManager.LOG_LEVELS.ERROR;
                case 'warning':
                    return loggerManager.LOG_LEVELS.WARNING;
                case 'info':
                    return loggerManager.LOG_LEVELS.INFO;
                case 'debug':
                    return loggerManager.LOG_LEVELS.DEBUG;
                default:
                    throw new Error(`Unknown log level: ${level}`);
            }
        }
    }

    return DEFAULT_LOG_LEVEL;
}

function main(){
    let logLevel = getLogLevel();
    loggerManager.setLogLevel(logLevel);
    Object.entries(loggerManager.LOG_LEVELS).forEach(([k, v]) => {
        if (logLevel == v){
            console.log(`Running with log level: ${k}`);
        }
    })
    
    let logger = loggerManager.newLogger('main');
    let webapp = require('./webapp');
    let indexer = require('./indexer');

    let start = async () => {
        await logger.logInfo('Starting webapp!');
        await webapp.start();

        await logger.logInfo('Starting indexer!');
        await indexer.start();
    }

    let stop = async () => {
        await logger.logInfo('Stopping webapp!');
        await webapp.stop();

        await logger.logInfo('Stopping indexer!');
        await indexer.stop();
    }

    start(logger).then(async () => {
        await logger.logInfo('Server has started!')
    }).catch(async (err) => {
        await logger.logCritical(`Could not start server: ${err.message}`)

        await stop(logger);
        process.exit(1);
    })
}

main();