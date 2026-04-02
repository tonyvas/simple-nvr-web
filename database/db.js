const sqlite = require('node:sqlite');

const fs = require('fs');
const path = require('path');

const Logger = require('../logger');

const DATABASE_PATH = path.join(__dirname, 'recordings.db');

class DatabaseManager{
    constructor(dbPath){
        this._isSetup = false;
        this._db = null;
        this._logger = null;

        this._dbPath = dbPath;
    }

    async init(){
        if (this._isSetup){
            throw new Error('Indexer is already initialized!');
        }

        this._isSetup = true;

        this._db = new sqlite.DatabaseSync(this._dbPath);
        this._logger = new Logger('db', process.env.logLevel);
    }

    async exec(sql){
        if (!this._isSetup){
            throw new Error(`DatabaseManager is not yet initialized!`);
        }

        let start = Date.now();
        this._db.exec(sql);
        let end = Date.now();

        await this._logger.logDebug(`Executed in ${end-start}ms`);
    }

    async query(sql, values=null){
        if (!this._isSetup){
            throw new Error(`DatabaseManager is not yet initialized!`);
        }

        // console.log(sql, values)
        let start = Date.now();

        let statement = this._db.prepare(sql);

        let rows;        
        if (values == null){
            rows = statement.all();
        }
        else{
            rows = statement.all(...values)
        }

        let end = Date.now();

        if (rows.length == 0){
            await this._logger.logDebug(`Queried in ${end-start}ms`);
        }
        else{
            await this._logger.logDebug(`Queried ${rows.length} rows in ${end-start}ms`);
        }

        return rows;
    }
}

if (!fs.existsSync(DATABASE_PATH)){
    throw new Error('Database not found, set it up with "npm run setup_db" first!');
}

module.exports = new DatabaseManager(DATABASE_PATH);