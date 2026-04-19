const fs = require('fs');
const path = require('path');
const PQueue = require('p-queue').default;

const loggerManager = require('./logger-manager');
const { Source, Recording } = require('./models/models');

const db = require('./database/db');
const utils = require('./utils');

const VIDEO_FILE_EXTENSION = '.mp4';
const THUMB_FILE_EXTENSION = '.jpg';

const DEFAULT_FULL_SCAN_INTERVAL = 300;
const DEFAULT_PART_SCAN_INTERVAL = 30;

const DEFAULT_THUMB_DIRPATH = path.join(__dirname, 'thumbs');
const DEFAULT_MAX_CONCURRENCY = 10;

const NVR_STORAGE_DIRPATH = path.resolve(process.env.NVR_STORAGE_DIRPATH);
const THUMB_DIRPATH = path.resolve(process.env.THUMB_STORAGE_DIRPATH || DEFAULT_THUMB_DIRPATH);

const MAX_CONCURRENCY = Number(process.env.MAX_CONCURRENCY || DEFAULT_MAX_CONCURRENCY);
const FULL_SCAN_INTERVAL = Number(process.env.FULL_SCAN_INTERVAL || DEFAULT_FULL_SCAN_INTERVAL);
const PART_SCAN_INTERVAL = Number(process.env.PART_SCAN_INTERVAL || DEFAULT_PART_SCAN_INTERVAL);

class Indexer{
    constructor(){
        this._isStarted = false;
        this._isScanning = false;
        this._scanHandle = null;

        this._logger = loggerManager.newLogger('indexer');
        this._pqueue = new PQueue({ concurrency: MAX_CONCURRENCY });
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

    async stop(){
        if (this._scanHandle){
            clearInterval(this._scanHandle);
            this._isStarted = false;
        }
    }

    _setupScanning(){
        let lastFullScanTime = Date.now();
        let lastPartScanTime = Date.now();

        this._scanHandle = setInterval(async () => {
            try{
                let now = Date.now();

                if ((now - lastFullScanTime) / 1000 >= FULL_SCAN_INTERVAL){
                    lastFullScanTime = now;
                    lastPartScanTime = now;

                    if (this._isScanning){
                        return await this._logger.logWarning('Cannot start full scan, scan still in process!');
                    }

                    await this._runFullScan();
                }
                else if ((now - lastPartScanTime) / 1000 >= PART_SCAN_INTERVAL){
                    lastPartScanTime = now;

                    if (this._isScanning){
                        return await this._logger.logWarning('Cannot start partial scan, scan still in process!');
                    }

                    await this._runPartialScan();
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
            await this._logger.logInfo('Starting partial scan!')

            this._isScanning = true;
            let numAdded = 0;

            let start = Date.now();

            for (let source of await this._getSourcesFromDatabase()){
                let latestRecording = await this._getLatestRecording(source);
                let dateDirs = await this._listDirectory(path.join(source.path, 'videos'));

                let promises = [];

                for (let dateDir of dateDirs.toSorted().toReversed()){
                    let datepath = path.join(source.path, 'videos', dateDir);
                    let videos = await this._listDirectory(datepath);

                    for (let video of videos.toSorted().toReversed()){
                        if (!video.endsWith(VIDEO_FILE_EXTENSION)){
                            // Skip non-video files
                            continue;
                        }
                        
                        let [startMS, _] = this._parseRecordingTimestamp(video);

                        if (startMS > latestRecording.startTS){
                            let videoPath = path.join(datepath, video);
                            let prom = this._pqueue.add(async () => {
                                try {
                                    await this._addRecording(source, videoPath)
                                    numAdded++;
                                } catch (error) {
                                    await this._logger.logError(`Failed to add recording at ${videoPath}: ${error.message}`);
                                }
                            })

                            promises.push(prom);
                        }
                    }
                }

                await Promise.all(promises);
            }

            let end = Date.now();
            await this._logger.logInfo(`Added ${numAdded} recordings in ${end-start}ms!`);
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
                await this._logger.logInfo(`Starting full scan for source ID=${source.id}!`)
                
                let start = Date.now();
                let scanDirpath = path.join(source.path, 'videos');
                let numAdded = 0;
                let numDeleted = 0;

                let fsPaths = [];
                for (let relpath of await this._listDirectory(scanDirpath, true)){
                    if (path.basename(relpath).endsWith(VIDEO_FILE_EXTENSION)){
                        fsPaths.push(path.resolve(scanDirpath, relpath))
                    }
                }

                let dbRecordings = await this._getRecordingsOfSourceFromDatabase(source);
                let dbPaths = dbRecordings.map(r => r.videoPath);

                let promises = [];
                for (let rpath of fsPaths){
                    if (dbPaths.indexOf(rpath) < 0){
                        let prom = this._pqueue.add(async () => {
                            try {
                                await this._addRecording(source, rpath)
                                numAdded++;
                            } catch (error) {
                                await this._logger.logError(`Failed to add recording at ${rpath}: ${error.message}`);
                            }
                        });

                        promises.push(prom);
                    }
                }

                await Promise.all(promises);

                for (let recording of dbRecordings){
                    try {
                        if (fsPaths.indexOf(recording.videoPath) < 0){
                            await this._removeRecording(recording);
                            numDeleted++;
                        }
                    } catch (error) {
                        await this._logger.logError(`Failed to remove recording: ${error.message}`);
                    }
                }

                let end = Date.now();
                await this._logger.logInfo(`Added ${numAdded} and deleted ${numDeleted} recordings in ${end-start}ms!`);
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
        await this._logger.logDebug(`Adding recording at ${videoPath}`);
        
        let perfTotalStart = Date.now();
        let [startMS, offsetMS] = this._parseRecordingTimestamp(path.basename(videoPath));
        
        let perfMetaStart = Date.now();
        let metadata = await utils.getMetadata(videoPath);

        let bitrate = metadata.format.bit_rate ? Number(metadata.format.bit_rate) : null;
        let duration = metadata.format.duration ? Math.round(metadata.format.duration) : null;
        let size = metadata.format.size ? Number(metadata.format.size) : null;
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

        let perfMetaTime = Date.now() - perfMetaStart;
        
        // Assume NVR created thumbnail
        let thumbPath = videoPath.replace(VIDEO_FILE_EXTENSION, THUMB_FILE_EXTENSION);

        // If it didn't, create one in thumbnail storage directory
        if (!fs.existsSync(thumbPath)){
            thumbPath = path.join(THUMB_DIRPATH, source.name, `${startMS}${THUMB_FILE_EXTENSION}`);
        }

        let recording = new Recording(null, source, startMS, offsetMS, videoPath, thumbPath, duration, size, bitrate, videoCodec, audioCodec);
        
        let perfInsertStart = Date.now();
        try {
            recording.id = await this._insertRecordingIntoDatabase(recording);    
        } catch (error) {
            throw new Error(`Failed to insert recording into database: ${error.message}`);
        }
        let perfInsertTime = Date.now() - perfInsertStart;

        let perfThumbStart = Date.now();
        try {
            if (thumbPath.startsWith(THUMB_DIRPATH)){
                // Create thumbnail if needed
                await utils.generateThumbnail(videoPath, thumbPath);
            }
        } catch (error) {
            await this._logger.logWarning(`Failed to generate thumbnail for ${videoPath}`);
            await this._logger.logDebug(`Thumbnail error: ${error.message}`);
        }
        let perfThumbTime = Date.now() - perfThumbStart;
        let perfTotalTime = Date.now() - perfTotalStart;

        await this._logger.logDebug(`Added recording in ${perfTotalTime}ms (metadata: ${perfMetaTime}ms, insert: ${perfInsertTime}ms, thumbnail: ${perfThumbTime})`);
    }

    async _removeRecording(recording){
        await this._logger.logDebug(`Removing recording ID=${recording.id}`);

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
        await this._logger.logDebug(`Inserting source ${source.name}`);
        let rows = await db.query("INSERT INTO source ('name', 'path') VALUES (?, ?) RETURNING source_id", [source.name, source.path]);

        return rows[0]['source_id'];
    }

    /**
     * @param {Source} source 
     * @returns {void}
     */
    async _deleteSourceFromDatabase(source){
        await this._logger.logDebug(`Deleting source ${source.name}`);
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
