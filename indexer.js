const fs = require('fs');
const path = require('path');
const pLimit = require('p-limit').default;

const Logger = require('./logger');
const { Source, Recording } = require('./models/models');

const db = require('./database/db');
const utils = require('./utils');

const DEFAULT_FULL_SCAN_INTERVAL = 300;
const DEFAULT_PART_SCAN_INTERVAL = 30;

const DEFAULT_THUMB_DIRPATH = path.join(__dirname, 'thumbs');
const DEFAULT_THUMB_MAX_BATCH = 10;

const NVR_STORAGE_DIRPATH = path.resolve(process.env.NVR_STORAGE_DIRPATH);
const THUMB_DIRPATH = path.resolve(process.env.THUMB_STORAGE_DIRPATH || DEFAULT_THUMB_DIRPATH);

const THUMB_MAX_BATCH = Number(process.env.THUMB_MAX_BATCH || DEFAULT_THUMB_MAX_BATCH);
const FULL_SCAN_INTERVAL = Number(process.env.FULL_SCAN_INTERVAL || DEFAULT_FULL_SCAN_INTERVAL);
const PART_SCAN_INTERVAL = Number(process.env.PART_SCAN_INTERVAL || DEFAULT_PART_SCAN_INTERVAL);

class Indexer{
    constructor(){
        this._isStarted = false;
        this._isScanning = false;
        this._scanHandle = null;

        this._logger = new Logger('indexer.log');
        this._plimit = pLimit(THUMB_MAX_BATCH);
    }

    async start(){
        if (this._isStarted){
            throw new Error('Cannot start indexer, already running!')
        }

        try{
            this._isStarted = true;
            await this._runFullScan();
        }
        catch(err){
            throw new Error(`Failed to scan on startup: ${err.message}`);
        }

        try {
            this._setupScanning();
        } catch (error) {
            throw new Error(`Failed to setup scanning: ${error.message}`);
        }
    }

    _setupScanning(){
        let lastFullScanTime = Date.now();
        let lastPartScanTime = Date.now();

        this._scanHandle = setInterval(async () => {
            try{
                let now = Date.now();

                if ((now - lastFullScanTime) / 1000 >= FULL_SCAN_INTERVAL){
                    await this._logger.logInfo('Running full scan!')
                    await this._runFullScan();
                    lastFullScanTime = now;
                    lastPartScanTime = now;
                }
                else if ((now - lastPartScanTime) / 1000 >= PART_SCAN_INTERVAL){
                    await this._logger.logInfo('Running partial scan!')
                    await this._runPartialScan();
                    lastPartScanTime = now;
                }
            }
            catch(err){
                await this._logger.logError(`Failed to scan: ${err.message}`)
            }
        }, 1000);
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
                    resolve(children.toSorted());
                }
            })
        })
    }

    async _runPartialScan(){
        if (this._isScanning){
            throw new Error('Scan already in progress!');
        }

        try{
            this._isScanning = true;

            let start = Date.now();
            for (let source of await this._getSourcesFromDatabase()){
                let latestRecording = await this._getLatestRecording(source);
                
                let dateDirs = await this._listDirectory(path.join(source.path, 'videos'));
                for (let dateDir of dateDirs.toSorted().toReversed()){
                    let datepath = path.join(source.path, 'videos', dateDir);

                    let videos = await this._listDirectory(datepath);
                    for (let video of videos.toSorted().toReversed()){
                        let [startMS, _] = this._parseRecordingTimestamp(video);
                        if (startMS > latestRecording.startTS){
                            let videoPath = path.join(datepath, video);
                            await this._addRecording(source, videoPath);
                        }
                    }
                }
            }

            let end = Date.now();
            await this._logger.logInfo(`Partial scan completed in ${end-start}ms!`);
        }
        catch (error){
            throw error;
        }
        finally{
            this._isScanning = false;
        }
    }

    async _runFullScan(){
        if (this._isScanning){
            throw new Error('Scan already in progress!');
        }

        try{
            this._isScanning = true;

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

                let tasks = [];
                for (let rpath of fsPaths){
                    if (dbPaths.indexOf(rpath) < 0){
                        tasks.push(this._plimit(() => this._addRecording(source, rpath)));
                    }
                }

                try {
                    await Promise.all(tasks)
                } catch (error) {
                    throw new Error(`Failed to add recordings: ${error.message}`)
                }

                for (let recording of dbRecordings){
                    if (fsPaths.indexOf(recording.videoPath) < 0){
                        await this._removeRecording(recording);
                    }
                }

                let end = Date.now();
                await this._logger.logInfo(`Full scan for source ID=${source.id} completed in ${end-start}ms!`);
            }
        }
        catch (error){
            throw error;
        }
        finally{
            this._isScanning = false;
        }
    }

    async _addRecording(source, videoPath){
        await this._logger.logInfo(`Adding recording at ${videoPath}`);

        let [startMS, offsetMS] = this._parseRecordingTimestamp(path.basename(videoPath));
        let thumbPath = path.join(THUMB_DIRPATH, source.name, `${startMS}.jpg`);

        let metadata = await utils.getMetadata(videoPath);
        
        let bitrate = metadata.format.bit_rate;
        let duration = Math.round(metadata.format.duration);
        let size = metadata.format.size;
        let audioCodec = null;
        let videoCodec = null;

        for (let stream of metadata.streams){
            if (stream.codec_type == 'video'){
                videoCodec = stream.codec_name;
            }
            else if (stream.codec_type == 'audio'){
                audioCodec = stream.codec_name;
            }
        }

        let recording = new Recording(null, source, startMS, offsetMS, videoPath, thumbPath, duration, size, bitrate, videoCodec, audioCodec);
        
        try {
            recording.id = await this._insertRecordingIntoDatabase(recording);
        } catch (error) {
            throw new Error(`Failed to insert recording into database: ${error.message}`);
        }

        try {
            await utils.generateThumbnail(videoPath, thumbPath);
        } catch (error) {
            await this._logger.logWarning(`Failed to generate thumbnail: ${error.message}`);
        }
    }

    async _removeRecording(recording){
        await this._logger.logInfo(`Removing recording ID=${recording.id}`);

        if (recording.thumbPath){
            try {
                fs.unlinkSync(recording.thumbPath);
            } catch (error) {
                await this._logger.logWarning(`Failed to delete thumbnail at ${recording.thumbPath}`);
            }
        }

        await this._deleteRecordingFromDatabase(recording);
    }

    async _updateSources(){
        let fsSourceNames = await this._listDirectory(NVR_STORAGE_DIRPATH);

        let dbSources = await this._getSourcesFromDatabase();
        let dbSourceNames = dbSources.map(s => s.name);

        for (let name of fsSourceNames){
            if (dbSourceNames.indexOf(name) < 0){
                let source = new Source(null, name, path.join(NVR_STORAGE_DIRPATH, name));
                await this._insertSourceIntoDatabase(source);
            }
        }

        for (let source of dbSources){
            if (fsSourceNames.indexOf(source.name) < 0){
                await this._deleteSourceFromDatabase(source);
            }
        }
    }

    async _getLatestRecording(source){
        const SQL = 'SELECT * FROM recording WHERE source_id = ? ORDER BY start_ts DESC LIMIT 1';
        let rows = await db.query(SQL, [source.id]);

        return rows.length == 0 ? null : Recording.fromDatabaseObject(source, rows[0]);
    }

    /**
     * @param {Source} source 
     * @returns {void}
     */
    async _insertSourceIntoDatabase(source){
        await this._logger.logInfo(`Inserting source ${source.name}`);
        let rows = await db.query("INSERT INTO source ('name', 'path') VALUES (?, ?) RETURNING source_id", [source.name, source.path]);

        return rows[0]['source_id'];
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
                source_id, start_ts, utc_offset, video_path, thumb_path,
                duration, size, bitrate, vcodec, acodec
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING recording_id
        `;

        let values = [
            recording.source.id, recording.startTS, recording.utcOffset, recording.videoPath, recording.thumbPath,
            recording.duration, recording.size, recording.bitrate, recording.videoCodec, recording.audioCodec
        ]

        let rows = await db.query(SQL, values);
        
        return rows[0]['recording_id'];
    }

    /**
     * @param {Recording} recording
     * @returns {void}
     */
    async _deleteRecordingFromDatabase(recording){
        const SQL = 'DELETE FROM recording WHERE recording_id=?';

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