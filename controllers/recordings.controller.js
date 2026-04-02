const router = require('express').Router()

const {BadRequestError, NotFoundError} = require('../errors');
const service = require('../services/recordings.service');
const {formatDate, formatTime, formatBitrate, formatSize} = require('../utils');

router.get('/', async (req, res, next) => {
    try {
        const DEFAULT_LIMIT = 10;

        const sourcesQuery = req.query.src;
        const limitQuery = req.query.lmt;
        const olderThanCursorQuery = req.query.otc;
        const newerThanCursorQuery = req.query.ntc;
        const newerThanDateQuery = req.query.ntd;
        const olderThanDateQuery = req.query.otd;
        const newerThanTimeQuery = req.query.ntt;
        const olderThanTimeQuery = req.query.ott;
        const viewQuery = req.query.v;
        
        let sources = null;
        let limit = null;
        let cursor = null;
        let desc = true;

        if (olderThanCursorQuery && newerThanCursorQuery){
            throw new BadRequestError(`Multiple cursors provided, but only one supported!`);
        }

        if (sourcesQuery){
            sources = [];

            for (let id of sourcesQuery.split('-')){
                sources.push(await service.getSourceById(Number(id.trim())));
            }
        }

        if (limitQuery){
            limit = Number(limitQuery);
        }
        else{
            limit = DEFAULT_LIMIT;
        }

        if (olderThanCursorQuery){
            cursor = await service.getRecordingById(olderThanCursorQuery);
            desc = true;
        }
        else if (newerThanCursorQuery){
            cursor = await service.getRecordingById(newerThanCursorQuery);
            desc = false;
        }
        
        let {recordings, oldest, hasOlder, newest, hasNewer} = await service.getPaginatedRecordings(sources, cursor, limit, desc, newerThanDateQuery, olderThanDateQuery, newerThanTimeQuery, olderThanTimeQuery);
        let allSources = await service.getSources();

        res.render('recording-list-table.ejs', {
            formatDate, formatTime,
            sources: allSources,
            recordings, oldest, hasOlder, newest, hasNewer,
        });
    } catch (err) {
        throw err;
    }
})

router.get('/:recording_id', async (req, res, next) => {
    try {
        const id = req.params.recording_id;

        let recording = await service.getRecordingById(id);
        let {next, prev} = await service.getRecordingNeighbors(recording);
        let related = await service.getRelatedRecordings(recording);
        console.log(related)

        res.render('recording-details', { recording, next, prev, related, formatDate, formatTime, formatSize, formatBitrate});
    } catch (err) {
        throw err;
    }
})

module.exports = router;