function save_options() {
	// Save Monitored Folders
	const monitoredFoldersTable = document.getElementById('monitored_folders_table').getElementsByTagName('tbody')[0];
	const monitoredFolders = [];
	for (let i = 0; i < monitoredFoldersTable.rows.length - 1; i++) {
		const input = monitoredFoldersTable.rows[i].querySelector('input[type=text]');
		if (input.value) {
			monitoredFolders.push(input.value);
		}
	}
	localStorage.setItem('dr_monitored_folders', JSON.stringify(monitoredFolders));


	// Save standard routing maps
	var maps = [{}, {}, {}];
	var tables = [
		document.getElementById('mime_mapping_table').getElementsByTagName('tbody')[0],
		document.getElementById('referrer_mapping_table').getElementsByTagName('tbody')[0],
		document.getElementById('filename_mapping_table').getElementsByTagName('tbody')[0]
	];

	for(var idx in tables) {
		for(var i = 0; i < tables[idx].rows.length - 1; i++) {
			const keyInput = tables[idx].rows[i].getElementsByTagName('input')[0];
            const pathInput = tables[idx].rows[i].getElementsByTagName('input')[1];

			// Only save the rule if both a key and a path are provided.
			if(keyInput.value && pathInput.value) {
				maps[idx][keyInput.value] = check_trailing(pathInput.value);
			}
		}
	}

	localStorage.setItem('dr_mime_map', JSON.stringify(maps[0]));
	localStorage.setItem('dr_referrer_map', JSON.stringify(maps[1]));
	localStorage.setItem('dr_filename_map', JSON.stringify(maps[2]));


	var order = document.getElementById('rule_order').value;
	order = order.replace(/\s+/g, '');
	order = order.split(',', 3);

	['filename', 'referrer', 'mime'].every(function(item) {
		if(order.indexOf(item) == -1) {
			alert('Invalid ruleset hierarchy, resetting to default.');
			order = ['filename', 'referrer', 'mime'];
			return false;
		}

		return true;
	}); 

	localStorage.setItem('dr_order', JSON.stringify(order));
	localStorage.setItem('dr_global_ref_folders',
		JSON.parse(document.querySelector('#global_ref_folders').checked));

	var status = document.getElementById('status');
	status.innerHTML = '<span class="green">&#10004;</span> Settings saved!';
	status.style.display = 'block';
	setTimeout(function() {
		status.innerHTML = '';
		status.style.display = 'none';
	}, 1500);
}

function restore_options() {
	// Restore Monitored Folders
	const monitoredFolders = JSON.parse(localStorage.getItem('dr_monitored_folders')) || [];
	for (const folder of monitoredFolders) {
		add_monitored_folder_row(folder);
	}

	// Restore standard routing maps
	var tables = [
		document.getElementById('mime_mapping_table').getElementsByTagName('tbody')[0],
		document.getElementById('referrer_mapping_table').getElementsByTagName('tbody')[0],
		document.getElementById('filename_mapping_table').getElementsByTagName('tbody')[0]
	];

	var maps = ['dr_mime_map', 'dr_referrer_map', 'dr_filename_map'];
	var map_defaults = [
		{ 'image/jpeg': 'images/' , 'application/x-bittorrent': 'torrents/','video/mp4': 'videos/'},
		{},
		{}
	];

	for(var idx = 0; idx < maps.length; ++idx) {
		var map = localStorage.getItem(maps[idx]);
		map = map ? JSON.parse(map) : map_defaults[idx];
        localStorage.setItem(maps[idx], JSON.stringify(map));

		for(var key in map) {
			add_routing_rule_row(tables[idx], key, map[key]);
		}
	}

	var order = localStorage.getItem('dr_order');
	order = order ? JSON.parse(order) : ['filename', 'referrer', 'mime'];
	localStorage.setItem('dr_order', JSON.stringify(order));
	document.getElementById('rule_order').value = order;


	var global_ref_folders = JSON.parse(localStorage.getItem('dr_global_ref_folders')) || false;
    localStorage.setItem('dr_global_ref_folders', JSON.stringify(global_ref_folders));
	document.getElementById('global_ref_folders').checked = global_ref_folders;
}

function check_trailing(path) {
	if (!path) {
		return "";
	}
	// Standardize to './' and don't add a slash for "keep original folder" rule.
	if (path.trim() === './' || path.trim() === '.\\') {
		return './';
	}
	// If it's any other path, ensure it ends with a forward slash.
	if (path.slice(-1) === '/' || path.slice(-1) === '\\') {
		return path.replace(/\\/g, '/');
	}
	return path.replace(/\\/g, '/') + '/';
}

// Generic function to add a routing rule row
function add_routing_rule_row(table, key = '', path = '') {
    const newRow = table.insertRow(table.rows.length - 1);
    const keyCell = newRow.insertCell(0);
    const spaceCell = newRow.insertCell(1);
    const destCell = newRow.insertCell(2);
    const delCell = newRow.insertCell(3);

    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.value = key;
    keyCell.appendChild(keyInput);

    const pathInput = document.createElement('input');
    pathInput.type = 'text';
    pathInput.value = path;
    destCell.appendChild(pathInput);

    const delInput = document.createElement('button');
    delInput.className = 'btn delete';
    delInput.innerHTML = '&#215;';
    delInput.onclick = function() {
        this.closest('tr').remove();
    };
    delCell.appendChild(delInput);

    spaceCell.appendChild(document.createTextNode('➜'));
}


function add_monitored_folder_row(value = '') {
    const table = document.getElementById('monitored_folders_table').getElementsByTagName('tbody')[0];
    const newRow = table.insertRow(table.rows.length - 1);
    const pathCell = newRow.insertCell(0);
    const delCell = newRow.insertCell(1);
    
    const pathInput = document.createElement('input');
    pathInput.type = 'text';
    pathInput.placeholder = 'e.g., C:\\Users\\YourName\\Downloads';
    pathInput.value = value;
    pathCell.appendChild(pathInput);

    const delInput = document.createElement('button');
    delInput.className = 'btn delete';
    delInput.innerHTML = '&#215;';
    delInput.onclick = function() {
        this.closest('tr').remove();
    };
    delCell.appendChild(delInput);
}


function add_monitored_folder_route() {
    add_monitored_folder_row();
}

function add_mime_route() {
	const table = document.getElementById('mime_mapping_table').getElementsByTagName('tbody')[0];
	add_routing_rule_row(table);
}

function add_referrer_route() {
	const table = document.getElementById('referrer_mapping_table').getElementsByTagName('tbody')[0];
	add_routing_rule_row(table);
}

function add_filename_route() {
	const table = document.getElementById('filename_mapping_table').getElementsByTagName('tbody')[0];
	add_routing_rule_row(table);
}

function options_setup() {
	var cont   = document.getElementById('wrap');
	var navs   = cont.querySelectorAll('ul#nav li');
	var tabs   = cont.querySelectorAll('.tab');
	var active = 'routing';

	if(!localStorage.getItem('dr_mime_map')) {
		active = 'usage';
		var status = document.getElementById('status');
		status.innerHTML = 'Thank you for installing Downloads Router!<br>Please read the instructions below, then head over to the routing rules to configure the extension.';
		status.style.display = 'block';
		setTimeout(function() {
			status.innerHTML = '';
			status.style.display = 'none';
		}, 7500);
	}

	navs[0].parentNode.dataset.current = active;

	for(var i = 0; i < tabs.length; i++) {
		if(tabs[i].id != active) {
			tabs[i].style.display = 'none';
		}
		navs[i].onclick = handle_click;
		if(navs[i].dataset.tab == active) {
			navs[i].setAttribute('class', 'active');
		}
	}

	restore_options();
}

function handle_click() {
	var current  = this.parentNode.dataset.current;
	var selected = this.dataset.tab;

	if(current == selected) return;

	document.getElementById(current).style.display  = 'none';
	document.getElementById(selected).style.display = 'block';
	document.getElementById('nav_' + current).removeAttribute('class', 'active');
	this.setAttribute('class', 'active');
	this.parentNode.dataset.current = selected;
}

document.addEventListener('DOMContentLoaded', options_setup);
document.querySelector('#save').addEventListener('click', save_options);
document.querySelector('#add_monitored_folder_route').addEventListener('click', add_monitored_folder_route);
document.querySelector('#add_mime_route').addEventListener('click', add_mime_route);
document.querySelector('#add_referrer_route').addEventListener('click', add_referrer_route);
document.querySelector('#add_filename_route').addEventListener('click', add_filename_route);
