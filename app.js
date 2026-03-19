#!/usr/bin/node

require('dotenv').config();

const Logger = require('./logger');

let logger = new Logger('main.log');
let webapp = require('./webapp');
let indexer = require('./indexer');

async function start(){
    await logger.logInfo('Starting webapp!');
    await webapp.start();

    await logger.logInfo('Starting indexer!');
    await indexer.start();
}

async function stop(){
    await logger.logInfo('Stopping webapp!');
    await webapp.stop();

    await logger.logInfo('Stopping indexer!');
    await indexer.stop();
}

start().then(async () => {
    await logger.logInfo('Server has started!')
}).catch(async (err) => {
    await logger.logError(`Could not start server: ${err.message}`)

    await stop();
    process.exit(1);
})
