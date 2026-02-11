const sqlite = require('node:sqlite');

const path = require('path');

const DATABASE_PATH = path.join(__dirname, 'recordings.db');

class DatabaseManager{
    constructor(dbPath){
        this._db = new sqlite.DatabaseSync(dbPath);
    }

    async exec(sql){
        this._db.exec(sql);
    }

    async query(sql, values=null){
        // console.log(sql, values)
        let statement = this._db.prepare(sql);
        if (values == null){
            return statement.all();
        }
        else{
            return statement.all(...values)
        }
    }
}

module.exports = new DatabaseManager(DATABASE_PATH);