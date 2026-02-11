const fs = require('fs');
const path = require('path');

const Logger = require('./logger');
const {Source, Recording} = require('./models/models');
const db = require('./database/db');

const STORAGE_DIRPATH = process.env.STORAGE_DIRPATH;
const UPDATE_INTERVAL_MS = 30e3;

class Indexer{
    constructor(){
        this._isRunning = false;
        this._isUpdating = false;
        this._updateHandle = null;

        this._logger = new Logger('indexer.log');
    }

    async start(){
        try{
            await this._update();
        }
        catch(err){
            throw new Error(`Failed to update on startup: ${err.message}`);
        }

        this._updateHandle = setInterval(async () => {
            try{
                await this._update();
            }
            catch(err){
                await this._logger.logError(`Failed to update index: ${err.message}`)
            }
        }, UPDATE_INTERVAL_MS);
    }

    _parseRecordingTimestamp(name){
        let [yyyymmdd, hhmmss, timestamp] = name.split('.')[0].split('_');

        let year = yyyymmdd.substring(0, 4);
        let month = yyyymmdd.substring(4, 6);
        let day = yyyymmdd.substring(6, 8);
        let hour = hhmmss.substring(0, 2);
        let minute = hhmmss.substring(2, 4);
        let second = hhmmss.substring(4, 6);

        let startMS = timestamp*1000;
        let offsetMS = (startMS - Date.UTC(year, month-1, day, hour, minute, second));

        return [startMS, offsetMS];
    }

    _listDirectory(dirpath, recursive=false){
        return new Promise((resolve, reject) => {
            fs.readdir(dirpath, {recursive}, (err, children) => {
                if (err){
                    reject(err);
                }
                else{
                    resolve(children);
                }
            })
        })
    }

    async _update(){
        if (this._isUpdating){
            await this._logger.logWarning(`Cannot update index: update already in progress!`);
            return;
        }

        try {
            this._isUpdating = true;
            await this._runFullScan();
        }
        catch (err){
            throw new Error(`Failed to run full scan: ${err.message}`);
        }
        finally{
            this._isUpdating = false;
        }
    }

    async _runFullScan(){
        await this._logger.logInfo('Starting full scan!');

        await this._updateSources();

        for (let source of await this._getSourcesFromDatabase()){
            let start = Date.now();
            let scanDirpath = path.join(source.path, 'videos');

            let fsPaths = [];
            for (let relpath of await this._listDirectory(scanDirpath, true)){
                if (path.basename(relpath).endsWith('.mp4')){
                    fsPaths.push(path.resolve(scanDirpath, relpath))
                }
            }

            let dbRecordings = await this._getRecordingsOfSourceFromDatabase(source);
            let dbPaths = dbRecordings.map(r => r.videoPath);

            for (let rpath of fsPaths){
                if (dbPaths.indexOf(rpath) < 0){
                    let [startMS, offsetMS] = this._parseRecordingTimestamp(path.basename(rpath));
                    let recording = new Recording(null, source, startMS, offsetMS, rpath, null, null, null, null, null, null);
                    
                    await this._insertRecordingIntoDatabase(recording);
                }
            }

            for (let recording of dbRecordings){
                if (fsPaths.indexOf(recording.videoPath) < 0){
                    await this._deleteRecordingFromDatabase(recording);
                }
            }

            let end = Date.now();
            await this._logger.logInfo(`Full scan for source ID=${source.id} completed in ${end-start}ms!`);
        }
    }

    async _updateSources(){
        let fsSourceNames = await this._listDirectory(STORAGE_DIRPATH);

        let dbSources = await this._getSourcesFromDatabase();
        let dbSourceNames = dbSources.map(s => s.name);

        for (let name of fsSourceNames){
            if (dbSourceNames.indexOf(name) < 0){
                let source = new Source(null, name, path.join(STORAGE_DIRPATH, name));
                await this._insertSourceIntoDatabase(source);
            }
        }

        for (let source of dbSources){
            if (fsSourceNames.indexOf(source.name) < 0){
                await this._deleteSourceFromDatabase(source);
            }
        }
    }

    /**
     * @param {Source} source 
     * @returns {void}
     */
    async _insertSourceIntoDatabase(source){
        await this._logger.logInfo(`Inserting source ${source.name}`);
        await db.query("INSERT INTO source ('name', 'path') VALUES (?, ?)", [source.name, source.path]);
    }

    /**
     * @param {Source} source 
     * @returns {void}
     */
    async _deleteSourceFromDatabase(source){
        await this._logger.logInfo(`Deleting source ${source.name}`);
        await db.query('DELETE FROM source WHERE source_id=?', [source.id]);
    }

    /**
     * @param {Recording} recording
     * @returns {void}
     */
    async _insertRecordingIntoDatabase(recording){
        const SQL = `
            INSERT INTO recording (
                source_id, start_ts, utc_offset, video_path,
                thumb_path, duration, size, bitrate,
                vcodec, acodec
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        let values = [
            recording.source.id, recording.startTS, recording.utcOffset, recording.videoPath,
            recording.thumbPath, recording.duration, recording.size, recording.bitrate,
            recording.videoCodec, recording.audioCodec
        ]

        await this._logger.logInfo(`Inserting recording at ${recording.videoPath}`);
        await db.query(SQL, values);
    }

    /**
     * @param {Recording} recording
     * @returns {void}
     */
    async _deleteRecordingFromDatabase(recording){
        const SQL = 'DELETE FROM recording WHERE recording_id=?';

        await this._logger.logInfo(`Deleting recording at ${recording.videoPath}`);
        await db.query(SQL, [recording.id]);
    }

    /**
     * @returns {Source[]}
     */
    async _getSourcesFromDatabase(){
        const SQL = 'SELECT * FROM source';

        let rows = await db.query(SQL);
        return rows.map(row => Source.fromDatabaseObject(row))
    }

    /**
     * @param {Source}
     * @returns {Recording[]}
     */
    async _getRecordingsOfSourceFromDatabase(source){
        const SQL = 'SELECT * FROM recording WHERE source_id=?';

        let rows = await db.query(SQL, [source.id]);
        return rows.map(row => Recording.fromDatabaseObject(source, row));
    }
}

module.exports = new Indexer();