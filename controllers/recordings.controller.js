const router = require('express').Router()

const {BadRequestError, NotFoundError} = require('../errors');
const service = require('../services/recordings.service');
const {formatDate, formatTime} = require('../utils');

router.get('/', async (req, res, next) => {
    try {
        const DEFAULT_LIMIT = 10;

        const sourcesQuery = req.query.src;
        const limitQuery = req.query.lmt;
        const olderThanCursorQuery = req.query.otc;
        const newerThanCursorQuery = req.query.ntc;
        const afterDateQuery = req.query.adt;
        const beforeDateQuery = req.query.bdt;
        const viewQuery = req.query.v;
        
        let sources = null;
        let limit = null;
        let cursor = null;
        let desc = true;
        let isCardView = viewQuery && viewQuery.toLowerCase() == 'card';

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
        
        let {recordings, oldest, hasOlder, newest, hasNewer} = await service.getPaginatedRecordings(sources, cursor, limit, desc);
        let allSources = await service.getSources();

        let viewFile = isCardView ? 'recording-list-card.ejs' : 'recording-list-table.ejs'
        res.render(viewFile, {
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

        res.render('recording-details', { recording, next, prev, formatDate: date => {
            function padNumber(num, digits){
                return num.toString().padStart(digits, '0');
            }

            let year = padNumber(date.getUTCFullYear(), 4);
            let month = padNumber(date.getUTCMonth()+1, 2);
            let day = padNumber(date.getUTCDate(), 2);
            let hours = padNumber(date.getUTCHours(), 2);
            let minutes = padNumber(date.getUTCMinutes(), 2);
            let seconds = padNumber(date.getUTCSeconds(), 2);

            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        }});
    } catch (err) {
        throw err;
    }
})

module.exports = router;