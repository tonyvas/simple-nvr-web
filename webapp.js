const path = require('path')
const http = require('http');
const express = require('express');

class Webapp{
    constructor(){
        this._isRunning = false;

        this._setup();
    }

    _setup(){
        this.app = express();
        this.server = http.createServer(this.app);

        this.app.set('view engine', 'ejs');
        this.app.set('trust proxy', 2);
        this.app.use(express.json());
        this.app.use('/public', express.static(path.join(__dirname, 'public')))

        // Log all requests
        this.app.use(async (req, res, next) => {
            try {
                let address = req.ip;
                let method = req.method;
                let url = req.url;

                console.log(`New request from ${address} - ${method} ${url}`);
                next();
            } catch (error) {
                console.error(`Error: Failed to log request: ${error.message}`);
            }
        });

        this.app.use(require('./routes'));
    }

    start(){
        return new Promise((resolve, reject) => {
            if (this._isRunning){
                return reject(new Error(`Webapp is already running!`));
            }

            let port = process.env.PORT || DEFAULT_PORT;
            this.server.listen(port, resolve);

            this._isRunning = true;
        })
    }
}

module.exports = new Webapp();