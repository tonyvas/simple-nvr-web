const sqlite = require('node:sqlite');

const fs = require('fs');
const path = require('path');

const Logger = require('../logger');

const DATABASE_PATH = path.join(__dirname, 'recordings.db');

class DatabaseManager{
    constructor(dbPath){
        this._db = new sqlite.DatabaseSync(dbPath);
        this._logger = new Logger('db.log');
    }

    async exec(sql){
        let start = Date.now();
        this._db.exec(sql);
        let end = Date.now();

        await this._logger.logInfo(`Executed in ${end-start}ms`);
    }

    async query(sql, values=null){
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
            await this._logger.logInfo(`Queried in ${end-start}ms`);
        }
        else{
            await this._logger.logInfo(`Queried ${rows.length} rows in ${end-start}ms`);
        }

        return rows;
    }
}

if (!fs.existsSync(DATABASE_PATH)){
    throw new Error('Database not found, set it up with "npm run setup_db" first!');
}

module.exports = new DatabaseManager(DATABASE_PATH);