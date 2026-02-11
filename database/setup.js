const fs = require('fs');
const path = require('path');
const sqlite = require('node:sqlite');

const DATABASE_PATH = path.join(__dirname, 'recordings.db');
const SETUP_SCRIPT_PATH = path.join(__dirname, 'setup.sql');

try{
    if (fs.existsSync(DATABASE_PATH)){
        throw new Error('Database already exists, aborting setup!');
    }

    let db = new sqlite.DatabaseSync(DATABASE_PATH);
    let sql = fs.readFileSync(SETUP_SCRIPT_PATH, 'utf-8');
    db.exec(sql);

    console.log('Setup script ran successfully!');
}
catch (err){
    console.error(`Error: failed to setup database: ${err.message}`);
}