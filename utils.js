const {exec} = require('child_process');
const fs = require('fs');
const path = require('path');

function execChildProcess(cmd){
    return new Promise((resolve, reject) => {
        exec(cmd, (err, stdout, stderr) => {
            if (err){
                reject(new Error(`Failed to run subprocess: ${err.message}`))
            }
            else{
                resolve({stdout, stderr});
            }
        })
    })
}

function mkdir(path, recursive=false){
    return new Promise((resolve, reject) => {
        fs.mkdir(path, {recursive}, err => {
            if (err){
                reject(err)
            }
            else{
                resolve();
            }
        })
    })
}

async function generateThumbnail(videoPath, thumbPath){
    let cmd = `ffmpeg -i '${videoPath}' -ss 1 -vframes 1 -s 720x480 -q:v 2 -y '${thumbPath}'`;

    await mkdir(path.dirname(thumbPath), true);
    await execChildProcess(cmd);
}

async function getMetadata(videoPath){
    let cmd = `ffprobe -v error -print_format json -show_format -show_streams "${videoPath}"`;
    let {stdout, stderr} = await execChildProcess(cmd);

    return JSON.parse(stdout);
}

function padNumber(num, digits){
    return num.toString().padStart(digits, '0');
}

function formatDate(date){
    let year = padNumber(date.getUTCFullYear(), 4);
    let month = padNumber(date.getUTCMonth()+1, 2);
    let day = padNumber(date.getUTCDate(), 2);
    let hours = padNumber(date.getUTCHours(), 2);
    let minutes = padNumber(date.getUTCMinutes(), 2);
    let seconds = padNumber(date.getUTCSeconds(), 2);

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function formatTime(seconds){
    let h = Math.floor(seconds / 3600);
    seconds %= 3600;

    let m = Math.floor(seconds / 60);
    seconds %= 60;
    
    let s = Math.round(seconds);

    let parts = [];

    if (h > 0){
        parts.push(h);
    }
    parts.push(m);
    parts.push(s);

    return parts.map(p => padNumber(p, 2)).join(':');
}

module.exports = { execChildProcess, mkdir, generateThumbnail, getMetadata, padNumber, formatDate, formatTime };