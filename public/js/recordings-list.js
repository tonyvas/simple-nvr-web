const SOURCE_PARAM = 'src';
const LIMIT_PARAM = 'lmt';

const NEWER_THAN_CURSOR_PARAM = 'ntc';
const OLDER_THAN_CURSOR_PARAM = 'otc';

const NEWER_THAN_DATE_PARAM = 'ntd';
const OLDER_THAN_DATE_PARAM = 'otd';
const NEWER_THAN_TIME_PARAM = 'ntt';
const OLDER_THAN_TIME_PARAM = 'ott';

const SOURCE_SEPARATOR = '-';
const SOURCE_ID_ATTR = 'data-id';

const sourceControls = document.querySelector('#source_controls');
const limitControls = document.querySelector('#limit_controls');
const startRangeControls = document.querySelector('#range_start_controls');
const endRangeControls = document.querySelector('#range_end_controls');

const sourceCheckboxes = sourceControls.querySelectorAll('.source_checkbox');
const limitSelect = limitControls.querySelector('#limit_select');

const startDateInput = startRangeControls.querySelector('.date_input');
const startTimeInput = startRangeControls.querySelector('.time_input');
const endDateInput = endRangeControls.querySelector('.date_input');
const endTimeInput = endRangeControls.querySelector('.time_input');

function goLatestPage(){
    let url = new URL(window.location);
    let params = url.searchParams;

    params.delete(NEWER_THAN_CURSOR_PARAM);
    params.delete(OLDER_THAN_CURSOR_PARAM);

    window.location = url;
}

function goOldestPage(){
    alert('Not implemented yet!');
}

function loadInitialSourceControls(params){
    let src = params.get(SOURCE_PARAM);
    if (src){
        let ids = src.split(SOURCE_SEPARATOR);

        for (let checkbox of sourceCheckboxes){
            let id = checkbox.getAttribute(SOURCE_ID_ATTR)
            if (ids.indexOf(id) >= 0){
                checkbox.checked = true;
            }
        }
    }
}

function loadInitialLimitControls(params){
    let lmt = params.get(LIMIT_PARAM);
    if (lmt){
        let options = limitSelect.options;
        for (let i = 0; i < options.length; i++){
            if (options[i].value == lmt){
                limitSelect.selectedIndex = i;
                break;
            }
        }
    }
}

function loadInitialRangeControls(params){
    startDateInput.value = params.get(NEWER_THAN_DATE_PARAM);
    endDateInput.value = params.get(OLDER_THAN_DATE_PARAM);

    let startTime = params.get(NEWER_THAN_TIME_PARAM);
    startTimeInput.value = startTime ? startTime.replaceAll('-', ':') : '';

    let endTime = params.get(OLDER_THAN_TIME_PARAM);
    endTimeInput.value = endTime ? endTime.replaceAll('-', ':') : '';
}

function loadInitialControlValues(){
    let url = new URL(window.location);
    let params = url.searchParams;

    loadInitialSourceControls(params);
    loadInitialLimitControls(params);
    loadInitialRangeControls(params);
}

function getSelectedSourceIds(){
    let ids = [];
    for (let checkbox of sourceCheckboxes){
        if (checkbox.checked){
            ids.push(checkbox.getAttribute(SOURCE_ID_ATTR))
        }
    }

    return ids;
}

function updateSourceParams(params){
    let ids = getSelectedSourceIds();
    if (ids.length == 0){
        params.delete(SOURCE_PARAM);
    }
    else{
        params.set(SOURCE_PARAM, ids.join(SOURCE_SEPARATOR));
    }
}

function updateLimitParams(params){
    let lmt = limitSelect.options[limitSelect.selectedIndex].value;
    params.set(LIMIT_PARAM, lmt);
}

function updateRangeParams(params){
    if (startDateInput.value){
        params.set(NEWER_THAN_DATE_PARAM, startDateInput.value);
    }
    else{
        params.delete(NEWER_THAN_DATE_PARAM);
    }

    if (endDateInput.value){
        params.set(OLDER_THAN_DATE_PARAM, endDateInput.value);
    }
    else{
        params.delete(OLDER_THAN_DATE_PARAM);
    }

    if (startTimeInput.value){
        params.set(NEWER_THAN_TIME_PARAM, startTimeInput.value.replaceAll(':', '-'));
    }
    else{
        params.delete(NEWER_THAN_TIME_PARAM);
    }

    if (endTimeInput.value){
        params.set(OLDER_THAN_TIME_PARAM, endTimeInput.value.replaceAll(':', '-'));
    }
    else{
        params.delete(OLDER_THAN_TIME_PARAM);
    }
}

function updateOnFilter(){
    let url = new URL(window.location);
    let params = url.searchParams;

    updateSourceParams(params);    
    updateLimitParams(params);
    updateRangeParams(params);

    // params.delete(OLDER_THAN_CURSOR_PARAM);
    // params.delete(NEWER_THAN_CURSOR_PARAM);

    window.location = url;
}

startDateInput.onchange = () => {
    if (!startDateInput.value){
        // If input cleared
        return;
    }

    if (!endDateInput.value){
        // If end not set
        return;
    }

    // Make sure end date isn't before start
    if (endDateInput.value < startDateInput.value){
        endDateInput.value = startDateInput.value;
    }
}

endDateInput.onchange = () => {
    if (!endDateInput.value){
        // If input cleared
        return;
    }

    if (!startDateInput.value){
        // If start not set
        return;
    }

    // Make sure start is not after end
    if (startDateInput.value > endDateInput.value){
        startDateInput.value = endDateInput.value;
    }
}

loadInitialControlValues();