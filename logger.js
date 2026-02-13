const fs = require('fs');
const path = require('path');

const LOGS_DIRPATH = path.join(__dirname, 'logs', new Date().toISOString());

module.exports = class Logger{
    constructor(filename){
        this._filepath = path.join(LOGS_DIRPATH, filename);

        try {
            fs.mkdirSync(LOGS_DIRPATH, {recursive: true});
        } catch (error) {
            throw new Error(`Could not create log directory: ${error.message}`);
        }
    }

    _log(message){
        return new Promise((resolve, reject) => {
            let line = `${new Date().toISOString()} - ${message}`;

            console.log(line);
            fs.appendFile(this._filepath, line+'\n', 'utf-8', (err) => {
                if (err){
                    reject(new Error(`Could not write to log file: ${err.message}`));
                }
                else{
                    resolve();
                }
            });
        })
    }

    async logInfo(message){
        await this._log(`INFO: ${message}`);
    }

    async logWarning(message){
        await this._log(`WARN: ${message}`);
    }

    async logError(message){
        await this._log(`ERROR: ${message}`);
    }
}