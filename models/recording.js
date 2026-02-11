module.exports = class Recording{
    constructor(id, source, startTS, utcOffset, videoPath, thumbPath, duration, size, bitrate, videoCodec, audioCodec){
        this.id = id;
        this.source = source;
        this.startTS = startTS;
        this.utcOffset = utcOffset;
        this.videoPath = videoPath;
        this.thumbPath = thumbPath;
        this.duration = duration;
        this.size = size;
        this.bitrate = bitrate;
        this.videoCodec = videoCodec;
        this.audioCodec = audioCodec;
    }

    static fromDatabaseObject(source, row){
        let id = row['recording_id']
        let startTS = row['start_ts']
        let utcOffset = row['utc_offset']
        let videoPath = row['video_path']
        let thumbPath = row['thumb_path']
        let duration = row['duration']
        let size = row['size']
        let bitrate = row['bitrate']
        let videoCodec = row['vcodec']
        let audioCodec = row['acodec']

        return new Recording(id, source, startTS, utcOffset, videoPath, thumbPath, duration, size, bitrate, videoCodec, audioCodec);
    }
}