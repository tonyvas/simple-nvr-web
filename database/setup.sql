CREATE TABLE 'source' (
    'source_id' INTEGER PRIMARY KEY,
    'name' TEXT NOT NULL UNIQUE,
    'path' TEXT NOT NULL UNIQUE
);

CREATE TABLE 'recording' (
    'recording_id' INTEGER PRIMARY KEY,
    'source_id' INTEGER NOT NULL,

    'start_ts' INTEGER NOT NULL,
    'utc_offset' INTEGER NOT NULL,

    'video_path' TEXT NOT NULL UNIQUE,
    'thumb_path' TEXT DEFAULT NULL,

    'duration' INTEGER DEFAULT NULL,
    'size' INTEGER DEFAULT NULL,
    'bitrate' INTEGER DEFAULT NULL,
    'vcodec' TEXT DEFAULT NULL,
    'acodec' TEXT DEFAULT NULL,

    FOREIGN KEY ('source_id') REFERENCES 'source' ('source_id')
);