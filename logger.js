const fs = require('fs');
const path = require('path');

const LOGS_DIRPATH = path.join(__dirname, 'logs', new Date().toISOString());

class Logger{
    static LOG_LEVEL = { DEBUG: 1, INFO: 2, WARNING: 3, ERROR: 4, CRITICAL: 5 };

    constructor(name, logLevel){
        logLevel = Number(logLevel);

        if (logLevel === undefined){
            throw new Error(`Missing log level!`);
        }

        if (Object.values(Logger.LOG_LEVEL).indexOf(logLevel) < 0){
            throw new Error(`Invalid log level!`);
        }

        try {
            fs.mkdirSync(LOGS_DIRPATH, {recursive: true});
        } catch (error) {
            throw new Error(`Could not create log directory: ${error.message}`);
        }

        this._name = name;
        this._filepath = path.join(LOGS_DIRPATH, `${name}.log`);
        this._logLevel = logLevel;
    }

    _log(message){
        return new Promise((resolve, reject) => {
            let line = `${new Date().toISOString()} - ${message}`;

            console.log(`${this._name} - ${line}`);
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

    async logDebug(message){
        if (Logger.LOG_LEVEL.DEBUG >= this._logLevel){
            await this._log(`DEBUG: ${message}`);
        }
    }

    async logInfo(message){
        if (Logger.LOG_LEVEL.INFO >= this._logLevel){
            await this._log(`INFO: ${message}`);
        }
    }

    async logWarning(message){
        if (Logger.LOG_LEVEL.WARNING >= this._logLevel){
            await this._log(`WARNING: ${message}`);
        }
    }

    async logError(message){
        if (Logger.LOG_LEVEL.ERROR >= this._logLevel){
            await this._log(`ERROR: ${message}`);
        }
    }

    async logCritical(message){
        if (Logger.LOG_LEVEL.CRITICAL >= this._logLevel){
            await this._log(`CRITICAL: ${message}`);
        }
    }
}

module.exports = Logger;