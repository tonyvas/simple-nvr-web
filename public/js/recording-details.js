const video = document.getElementsByTagName('video')[0];
const speedSelect = document.getElementById('speed_select');

speedSelect.onchange = (e) => {
    let index = speedSelect.selectedIndex;
    
    video.playbackRate = speedSelect.options[index].value;
    sessionStorage.setItem('speed_index', index);
}

document.body.onload = () => {
    let index = sessionStorage.getItem('speed_index') || 0;
    
    speedSelect.selectedIndex = index;
    video.playbackRate = speedSelect.options[index].value;
}