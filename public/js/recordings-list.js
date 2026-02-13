const sourceDropdown = document.querySelector('#source_controls');
const sourceDropdownToggle = sourceDropdown.querySelector('#dropdown_toggle');
const sourceDropdownMenu = sourceDropdown.querySelector('#dropdown_menu');
const sourceDropdownMenuItems = sourceDropdownMenu.querySelectorAll('li');
const limitDropdown = document.querySelector('#limit_select');

function loadInitialControlValues(){
    let url = new URL(window.location);
    let params = url.searchParams;

    let src = params.get('src');
    if (src){
        let ids = src.split('-');

        for (let item of sourceDropdownMenuItems){
            let id = item.getAttribute('data-id')
            if (ids.indexOf(id) >= 0){
                item.classList.add('selected');
            }
        }
    }

    let lmt = params.get('lmt');
    if (lmt){
        let options = limitDropdown.options;
        for (let i = 0; i < options.length; i++){
            if (options[i].value == lmt){
                limitDropdown.selectedIndex = i;
                break;
            }
        }
    }

    hideDropdownMenu();
}

function getSelectedSourceIds(){
    let ids = [];
    for (let item of sourceDropdownMenuItems){
        if (item.classList.contains('selected')){
            ids.push(item.getAttribute('data-id'))
        }
    }

    return ids;
}

function updateOnFilter(){
    let url = new URL(window.location);
    let params = url.searchParams;

    let ids = getSelectedSourceIds();
    if (ids.length == 0){
        params.delete('src');
    }
    else{
        params.set('src', ids.join('-'));
    }

    let lmt = limitDropdown.options[limitDropdown.selectedIndex].value;
    params.set('lmt', lmt);

    params.delete('otc');
    params.delete('ntc');

    window.location = url;
}

function showDropdownMenu(){
    const rect = sourceDropdownToggle.getBoundingClientRect();

    sourceDropdownMenu.style.position = 'absolute';
    sourceDropdownMenu.style.top = rect.bottom + window.scrollY + 'px';
    sourceDropdownMenu.style.left = rect.left + window.scrollX + 'px';
    
    sourceDropdownMenu.style.display = 'block';
}

function hideDropdownMenu(){
    if (sourceDropdownMenu.style.display == 'block'){
        sourceDropdownMenu.style.display = 'none';
    }

    let selectedCount = getSelectedSourceIds().length;
    sourceDropdownToggle.innerHTML = `${selectedCount == 0 ? 'All' : selectedCount} Selected`
}

sourceDropdownToggle.addEventListener('click', () => {
    if (sourceDropdownMenu.style.display == 'block'){
        hideDropdownMenu();
    }
    else{
        showDropdownMenu();
    }
});

sourceDropdownMenuItems.forEach(item => {
    item.addEventListener('click', () => {
        item.classList.toggle('selected');
    });
});

document.addEventListener('click', (e) => {
    if (!sourceDropdown.contains(e.target) && sourceDropdownMenu.style.display == 'block') {
        hideDropdownMenu();
    }
});

loadInitialControlValues();