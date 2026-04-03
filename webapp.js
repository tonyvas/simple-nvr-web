const path = require('path')
const http = require('http');
const express = require('express');

const loggerManager = require('./logger-manager');

class Webapp{
    constructor(){
        this._isRunning = false;

        this.app = express();
        this.server = http.createServer(this.app);

        this.app.set('view engine', 'ejs');
        this.app.set('trust proxy', 2);
        this.app.use(express.json());
        this.app.use('/public', express.static(path.join(__dirname, 'public')))

        let reqLogger = loggerManager.newLogger('requests');
        let webLogger = loggerManager.newLogger('webapp');

        this.app.locals.webLogger = webLogger;

        // Log all requests
        this.app.use(async (req, res, next) => {
            let address = req.ip;
            let method = req.method;
            let url = req.url;

            await reqLogger.logInfo(`New request from ${address} - ${method} ${url}`);
            next();
        });

        this.app.use(require('./routes'));
    }

    start(){
        return new Promise((resolve, reject) => {
            if (this._isRunning){
                return reject(new Error(`Webapp is already running!`));
            }

            let port = process.env.PORT || DEFAULT_PORT;
            this.server.listen(port, () => {
                this._isRunning = true;
                resolve();
            });
        })
    }

    stop(){
        return new Promise((resolve, reject) => {
            if (!this._isRunning){
                resolve();
            }

            this.server.close(err => {
                if (err){
                    reject(new Error(`Failed to close server: ${err.message}`))
                }
                else{
                    this._isRunning = false;
                    resolve()
                }
            });
        });
    }
}

module.exports = new Webapp();
