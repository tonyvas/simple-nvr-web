const db = require('../database/db');

const {NotFoundError} = require('../errors');
const {Source, Recording} = require('../models/models')

/**
 * @param {number} id 
 * @returns {Source}
 */
async function getSourceById(id){
    const SQL = 'SELECT * FROM source WHERE source_id = ?';

    let rows = await db.query(SQL, [id]);
    let sources = rows.map(row => Source.fromDatabaseObject(row));

    if (sources.length == 0){
        throw new NotFoundError(`Source with ID=${id} does not exist!`);
    }

    return sources[0];
}

/**
 * @returns {Source[]}
 */
async function getSources(){
    const SQL = 'SELECT * FROM source';

    let rows = await db.query(SQL);
    return rows.map(row => Source.fromDatabaseObject(row));
}

/**
 * @param {Source} source 
 * @returns {number}
 */
async function getSourceRecordingCount(source){
    const SQL = 'SELECT COUNT(recording_id) as count FROM recording WHERE source_id = ?';

    let rows = await db.query(SQL, [source.id]);
    return rows[0]['count'];
}

module.exports = { getSourceById, getSources, getSourceRecordingCount };