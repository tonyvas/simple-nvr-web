const router = require('express').Router()

const {BadRequestError, NotFoundError} = require('../errors');
const service = require('../services/media.service');

router.get('/thumbs/:id', async (req, res, next) => {
    try {
        let id = req.params.id;
        let recording = await service.getRecordingById(id);

        if (recording.thumbPath){
            res.sendFile(recording.thumbPath);
        }
        else{
            throw new NotFoundError(`Could not find thumbnail for recording ID=${recording.id}`);
        }
    } catch (err) {
        throw err;
    }
})

router.get('/videos/:id', async (req, res, next) => {
    try {
        let id = req.params.id;
        let recording = await service.getRecordingById(id);

        if (recording.videoPath){
            res.sendFile(recording.videoPath);
        }
        else{
            throw new NotFoundError(`Could not find video for recording ID=${recording.id}`);
        }
    } catch (err) {
        throw err;
    }
})

module.exports = router;