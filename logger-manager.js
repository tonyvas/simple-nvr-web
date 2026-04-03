const fs = require('fs');
const path = require('path');

const DEFAULT_LOG_DIRPATH = path.join(__dirname, 'logs', new Date().toISOString());

class LoggerManager{
    static LOG_LEVELS = { DEBUG: 1, INFO: 2, WARNING: 3, ERROR: 4, CRITICAL: 5 };

    constructor(logDirpath=DEFAULT_LOG_DIRPATH, logLevel=LoggerManager.LOG_LEVELS.DEBUG){
        this.LOG_LEVELS = LoggerManager.LOG_LEVELS;

        this._logDirpath = logDirpath;
        this._manager = this;
        
        this.setLogLevel(logLevel);

        try {
            fs.mkdirSync(this._logDirpath, {recursive: true});
        } catch (error) {
            throw new Error(`Could not create log directory: ${error.message}`);
        }
    }

    setLogLevel(level){
        if (Object.values(LoggerManager.LOG_LEVELS).indexOf(level) < 0){
            throw new Error(`Invalid log level!`);
        }

        Logger._setLogLevel(level);
    }

    newLogger(name){
        return new Logger(path.join(this._logDirpath, `${name}.log`));
    }
}

class Logger{
    static _logLevel = LoggerManager.LOG_LEVELS.DEBUG;

    static _setLogLevel(level){
        Logger._logLevel = level;
    }

    constructor(filepath){
        this._filepath = filepath;
    }

    _log(message){
        return new Promise((resolve, reject) => {
            let line = `${new Date().toISOString()} - ${message}`;

            console.log(`${path.basename(this._filepath)} - ${line}`);
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
        if (Logger._logLevel <= LoggerManager.LOG_LEVELS.DEBUG){
            await this._log(`DEBUG: ${message}`);
        }
    }

    async logInfo(message){
        if (Logger._logLevel <= LoggerManager.LOG_LEVELS.INFO){
            await this._log(`INFO: ${message}`);
        }
    }

    async logWarning(message){
        if (Logger._logLevel <= LoggerManager.LOG_LEVELS.WARNING){
            await this._log(`WARNING: ${message}`);
        }
    }

    async logError(message){
        if (Logger._logLevel <= LoggerManager.LOG_LEVELS.ERROR){
            await this._log(`ERROR: ${message}`);
        }
    }

    async logCritical(message){
        if (Logger._logLevel <= LoggerManager.LOG_LEVELS.CRITICAL){
            await this._log(`CRITICAL: ${message}`);
        }
    }
}

module.exports = new LoggerManager();