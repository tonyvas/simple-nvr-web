const dropdown = document.querySelector('#source_dropdown');
const toggleBtn = dropdown.querySelector('#dropdown_toggle');
const menu = dropdown.querySelector('#dropdown_menu');
const items = menu.querySelectorAll('li');

function showDropdownMenu(){
    const rect = toggleBtn.getBoundingClientRect();

    menu.style.position = 'absolute';
    menu.style.top = rect.bottom + window.scrollY + 'px';
    menu.style.left = rect.left + window.scrollX + 'px';
    
    menu.style.display = 'block';
}

function hideDropdownMenu(){
    if (menu.style.display == 'block'){
        menu.style.display = 'none';
        updateOnFilter();
    }
}

function getSelectedSourceIds(){
    let ids = [];
    for (let item of items){
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

    params.delete('otc');
    params.delete('ntc');

    window.location = url;
}

toggleBtn.addEventListener('click', () => {
    if (menu.style.display == 'block'){
        hideDropdownMenu();
    }
    else{
        showDropdownMenu();
    }
});

// Toggle selection of cameras
items.forEach(item => {
    item.addEventListener('click', () => {
        item.classList.toggle('selected');
    });
});

// Close dropdown if clicking outside
document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && menu.style.display == 'block') {
        hideDropdownMenu();
    }
});

document.body.onload = () => {
    let url = new URL(window.location);
    let params = url.searchParams;

    let src = params.get('src');
    if (src){
        let ids = src.split('-');

        for (let item of items){
            let id = item.getAttribute('data-id')
            if (ids.indexOf(id) >= 0){
                item.classList.add('selected');
            }
        }
    }
}
