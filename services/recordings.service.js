const db = require('../database/db');

const {NotFoundError} = require('../errors');
const {Source, Recording} = require('../models/models');
const { getSourceById, getSources } = require('./sources.service');

/**
 * @param {number} recordingId 
 * @returns {Recording|null}
 */
async function getRecordingById(recordingId){
    let SQL = 'SELECT * FROM recording WHERE recording_id = ?'
    
    let rows = await db.query(SQL, [recordingId]);
    if (rows.length == 0){
        throw new NotFoundError(`Recording with ID=${recordingId} does not exist!`);
    }

    let row = rows[0];
    let source = await getSourceById(row['source_id']);

    return Recording.fromDatabaseObject(source, row);
}

/**
 * @param {Source[]} [sources=null]
 * @param {Recording} [cursor=null] 
 * @param {number} [limit=null] 
 * @param {boolean} [olderDirection=null] 
 * @returns {{Recording[], Recording, Recording}}
 */
async function getPaginatedRecordings(sources=null, cursor=null, limit=null, olderDirection=true, startDate=null, endDate=null){
    const MAX_LIMIT = 100;

    let wheres = [];
    let values = [];

    if (sources){
        let ids = sources.map(s => s.id);

        let q = ids.map(() => '?').join(',');
        wheres.push(`source_id IN (${q})`);

        for (let id of ids){
            values.push(id);
        }
    }

    if (cursor){
        if (olderDirection){
            wheres.push(`(start_ts, recording_id) < (?, ?)`);
        }
        else{
            wheres.push(`(start_ts, recording_id) > (?, ?)`);
        }
        
        values.push(cursor.startTS);
        values.push(cursor.id);
    }

    limit = limit ? Math.min(limit, MAX_LIMIT) : MAX_LIMIT;
    values.push(limit + 1);

    let order = olderDirection ? 'DESC' : 'ASC'
    let where = wheres.length > 0 ? `WHERE ${wheres.join(' AND ')}` : ''
    let sql = `SELECT * FROM recording ${where} ORDER BY start_ts ${order}, recording_id ${order} LIMIT ?`;

    let allSources = sources || await getSources();
    let rows = await db.query(sql, values);
    let recordings = rows.map(row => {
        for (let source of allSources){
            if (source.id == row['source_id']){
                return Recording.fromDatabaseObject(source, row)
            }
        }
    });

    let result = {
        recordings: [],
        newest: null, hasNewer: false,
        oldest: null, hasOlder: false
    }

    if (recordings.length == 0){
        return result;
    }

    if (olderDirection){
        result.recordings = recordings.splice(0, limit);
        result.hasNewer = cursor != null;                   // Cursor itself implies newer data exists
        result.hasOlder = rows.length > limit;              // More data in direction exists
    }
    else{
        result.recordings = recordings.splice(0, limit).toReversed();   // SQL ascending, return descending
        result.hasOlder = cursor != null;                               // Cursor itself implies older data exists
        result.hasNewer = rows.length > limit;                          // More data in direction exists
    }

    result.newest = result.recordings[0];
    result.oldest = result.recordings[result.recordings.length-1];

    return result;
}

async function getRecordingNeighbors(recording){
    let NEXT_SQL = 'SELECT * FROM recording WHERE source_id = ? AND start_ts > ? ORDER BY start_ts ASC LIMIT 1';
    let PREV_SQL = 'SELECT * FROM recording WHERE source_id = ? AND start_ts < ? ORDER BY start_ts DESC LIMIT 1';

    let values = [recording.source.id, recording.startTS];
    let nextRows = await db.query(NEXT_SQL, values);
    let prevRows = await db.query(PREV_SQL, values);

    let next = nextRows.length > 0 ? Recording.fromDatabaseObject(recording.source, nextRows[0]) : null;
    let prev = prevRows.length > 0 ? Recording.fromDatabaseObject(recording.source, prevRows[0]) : null;

    return {next, prev};
}

module.exports = { getSourceById, getSources, getRecordingById, getPaginatedRecordings, getRecordingNeighbors };