#!/usr/bin/node

require('dotenv').config();

let webapp = require('./webapp');
let indexer = require('./indexer');

async function start(){
    await webapp.start();
    console.log('Webapp has started!');

    await indexer.start();
    console.log('Indexer has started!');
}

start().then(() => {
    console.log('Server has started!')
}).catch(err => {
    console.error(`Error: could not start server: ${err.message}`)
})