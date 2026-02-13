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

module.exports = { execChildProcess, mkdir, generateThumbnail };