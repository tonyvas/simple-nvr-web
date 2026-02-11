const router = require('express').Router()

const { BadRequestError, NotFoundError } = require('./errors');

router.get('/', (req, res) => res.redirect('/recordings'));

router.use('/media', require('./controllers/media.controller'));
router.use('/sources', require('./controllers/sources.controller'));
router.use('/recordings', require('./controllers/recordings.controller'));

router.use((err, req, res, next) => {
    console.error(`Web error: ${err}`);
    
    if (err instanceof BadRequestError){
        res.status(400).render('error', { error: err.message });
    }
    else if (err instanceof NotFoundError){
        res.status(404).render('error', { error: err.message });
    }
    else{
        res.status(500).render('error', { error: 'Internal server error!' });
    }
})

module.exports = router;