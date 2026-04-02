const path = require('path')
const http = require('http');
const express = require('express');

const Logger = require('./logger')

class Webapp{
    constructor(){
        this._isSetup = false;
        this._isRunning = false;

        this.app = null;
        this.server = null;
    }

    async init(){
        if (this._isSetup){
            throw new Error('Webapp is already initialized!');
        }

        this._isSetup = true;

        this.app = express();
        this.server = http.createServer(this.app);

        this.app.set('view engine', 'ejs');
        this.app.set('trust proxy', 2);
        this.app.use(express.json());
        this.app.use('/public', express.static(path.join(__dirname, 'public')))

        let reqLogger = new Logger('requests', process.env.logLevel);
        let webLogger = new Logger('webapp', process.env.logLevel);

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

            if (!this._isSetup){
                return reject(new Error(`Webapp is not yet initialized!`));
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
