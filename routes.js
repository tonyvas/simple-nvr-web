const router = require('express').Router()

const { BadRequestError, NotFoundError } = require('./errors');

router.get('/', (req, res) => res.redirect('/recordings'));

router.use('/media', require('./controllers/media.controller'));
router.use('/sources', require('./controllers/sources.controller'));
router.use('/recordings', require('./controllers/recordings.controller'));

router.use(async (err, req, res, next) => {
    let logger = req.app.locals.webLogger;
    
    if (err instanceof BadRequestError){
        await logger.logError(`Bad request: ${err.message}`);
        res.status(400).render('error', { error: err.message });
    }
    else if (err instanceof NotFoundError){
        await logger.logError(`Not found: ${err.message}`);
        res.status(404).render('error', { error: err.message });
    }
    else{
        await logger.logError(`Internal: ${err.message}`);
        res.status(500).render('error', { error: 'Internal server error!' });
    }
})

module.exports = router;