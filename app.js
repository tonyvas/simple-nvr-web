#!/usr/bin/node

require('dotenv').config();

const Logger = require('./logger');

let db = require('./database/db');
let webapp = require('./webapp');
let indexer = require('./indexer');

function getLogLevel(){
    const DEFAULT_LOG_LEVEL = Logger.LOG_LEVEL.INFO;
    const CLI_KEY = '--log-level=';

    for (let arg of process.argv){
        if (arg.startsWith(CLI_KEY)){
            let level = arg.substring(CLI_KEY.length).toLowerCase();
            switch (level) {
                case 'critical':
                    return Logger.LOG_LEVEL.CRITICAL;
                case 'error':
                    return Logger.LOG_LEVEL.ERROR;
                case 'warning':
                    return Logger.LOG_LEVEL.WARNING;
                case 'info':
                    return Logger.LOG_LEVEL.INFO;
                case 'debug':
                    return Logger.LOG_LEVEL.DEBUG;
                default:
                    throw new Error(`Unknown log level: ${level}`);
            }
        }
    }

    return DEFAULT_LOG_LEVEL;
}

function main(){
    process.env.logLevel = getLogLevel();
    console.log(`Running with log level: ${process.env.logLevel}`);

    let logger = new Logger('main', process.env.logLevel);

    let start = async () => {
        await logger.logInfo('Setting up database manager!');
        await db.init();

        await logger.logInfo('Setting up indexer!');
        await indexer.init();

        await logger.logInfo('Setting up webapp!');
        await webapp.init();

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