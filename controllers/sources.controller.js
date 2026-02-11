const router = require('express').Router()

const {BadRequestError, NotFoundError} = require('../errors');
const service = require('../services/sources.service');

router.get('/', async (req, res, next) => {
    try {
        let sources = await service.getSources();

        let counts = [];
        for (let source of sources){
            counts.push(await service.getSourceRecordingCount(source));
        }
        
        res.render('source-list', { sources, counts });
    } catch (err) {
        throw err;
    }
})

module.exports = router;