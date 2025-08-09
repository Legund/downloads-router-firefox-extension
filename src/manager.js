var order    = JSON.parse(localStorage.getItem('dr_order'));
var rulesets = {};

if(!order) { 
	order = ['filename', 'referrer', 'mime'];
}

// Helper function to get the basename of a path, stripping any parent directories.
function getBasename(path) {
    // Handles both forward (/) and back (\\) slashes
    return path.substring(path.lastIndexOf('/') + 1).substring(path.lastIndexOf('\\') + 1);
}

rulesets['filename'] = function(downloadItem, suggest) {
	var filename_map = JSON.parse(localStorage.getItem('dr_filename_map'));
	var keys = Object.keys(filename_map);
	if (!keys.length) return false;

	for (var i = 0; i < keys.length; i++) {
		var keyword = keys[i];
		var regex = new RegExp(keyword, 'i');

		if (regex.exec(downloadItem.filename) || regex.exec(downloadItem.url)) {
			console.log(`[Downloads Router] Filename rule: Matched keyword '${keyword}'`);
            const basename = getBasename(downloadItem.filename);
			suggest({ filename: filename_map[keyword] + basename });
			return true;
		}
	}
	return false;
};

rulesets['referrer'] = function(downloadItem, suggest) {
	var ref_map = JSON.parse(localStorage.getItem('dr_referrer_map'));
    var ref_domain;

	if(Object.keys(ref_map).length) {
		var matches;
		if(downloadItem.referrer) {
			matches = downloadItem.referrer.match(/^https?\:\/\/([^\/:?#]+)(?:[\/:?#]|$)/i);
		} else {
			matches = downloadItem.url.match(/^https?\:\/\/([^\/:?#]+)(?:[\/:?#]|$)/i);
		}
		ref_domain = matches && matches[1].replace(/^www\./i, '');

		if(ref_map[ref_domain]) {
            const basename = getBasename(downloadItem.filename);
			suggest({ filename: ref_map[ref_domain] + basename });
			return true;
		}
	}

	if(JSON.parse(localStorage.getItem('dr_global_ref_folders'))) {
        if (ref_domain) {
            const basename = getBasename(downloadItem.filename);
		    suggest({ filename: ref_domain + '/' + basename });
		    return true;
        }
	}

	return false;
};

rulesets['mime'] = function(downloadItem, suggest) {
	var mime_map  = JSON.parse(localStorage.getItem('dr_mime_map'));
	var mime_type = downloadItem.mime;
    let extension = '';

    const sourceForExt = downloadItem.filename.includes('.') ? downloadItem.filename : downloadItem.url;
    const matches = sourceForExt.match(/\.([0-9a-z]+)(?:[\?#]|$)/i);
    if (matches) {
        extension = matches[1].toLowerCase();
    }

	if (!mime_type || mime_type === 'application/octet-stream') {
		const mapping = {
			'zip': 'application/zip', 'rar': 'application/vnd.rar', '7z': 'application/x-7z-compressed', 'tar': 'application/x-tar', 'gz': 'application/gzip',
			'pdf': 'application/pdf', 'doc': 'application/msword', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'xls': 'application/vnd.ms-excel', 'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'ppt': 'application/vnd.ms-powerpoint', 'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'txt': 'text/plain',
			'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'gif': 'image/gif', 'svg': 'image/svg+xml', 'webp': 'image/webp',
			'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
			'mp4': 'video/mp4', 'webm': 'video/webm', 'avi': 'video/x-msvideo', 'mkv': 'video/x-matroska',
			'exe': 'application/x-ms-dos-executable', 'torrent': 'application/x-bittorrent'
		};
		if (extension && mapping[extension]) {
			mime_type = mapping[extension];
		}
	}

	if (mime_type && mime_map[mime_type]) {
        const basename = getBasename(downloadItem.filename);
		suggest({ filename: mime_map[mime_type] + basename });
		return true;
	}

    if (extension && mime_map[extension]) {
        const basename = getBasename(downloadItem.filename);
        suggest({ filename: mime_map[extension] + basename });
        return true;
    }

	return false;
};

// --- HYBRID IMPLEMENTATION ---

const rerouting = new Set();

chrome.webRequest.onHeadersReceived.addListener(
    function(details) {
        let header = details.responseHeaders.find(h => h.name.toLowerCase() === 'content-disposition');
        if (!header || !header.value.toLowerCase().includes('attachment')) {
            return { responseHeaders: details.responseHeaders };
        }
        
        let originalFilename = "download";
        let filenameMatch = /filename\*?=(?:UTF-8'')?([^;]+)/i.exec(header.value);
        if (filenameMatch && filenameMatch[1]) {
            originalFilename = decodeURIComponent(filenameMatch[1].replace(/"/g, ''));
        }
        
        let contentTypeHeader = details.responseHeaders.find(h => h.name.toLowerCase() === 'content-type');
        let mimeType = (contentTypeHeader) ? contentTypeHeader.value.split(';')[0] : 'application/octet-stream';

        const simulatedDownloadItem = {
            filename: originalFilename, url: details.url,
            referrer: details.initiator || details.originUrl, mime: mimeType
        };
        
        let newPath = '';
        const suggest = (suggestion) => { newPath = suggestion.filename; };

        const order = JSON.parse(localStorage.getItem('dr_order')) || ['filename', 'referrer', 'mime'];
        order.every(rule => {
            if (rulesets[rule](simulatedDownloadItem, suggest)) return false;
            return true;
        });

        if (newPath) {
            header.value = `attachment; filename="${newPath.replace(/"/g, '\\"')}"`;
            rerouting.add(details.url);
        }

        return { responseHeaders: details.responseHeaders };
    },
    { urls: ["<all_urls>"], types: ["main_frame", "sub_frame", "other"] },
    ["blocking", "responseHeaders"]
);

chrome.downloads.onCreated.addListener(function(downloadItem) {
    if (rerouting.has(downloadItem.url)) {
        rerouting.delete(downloadItem.url);
        return;
    }

    const monitoredFolders = JSON.parse(localStorage.getItem('dr_monitored_folders')) || [];
    if (!monitoredFolders.length) {
        console.log("[Downloads Router] OnCreated: No monitored folders configured. Routing will not be applied.");
        return;
    }

    // MODIFIED: Correctly extract the download's parent directory for comparison.
    const downloadDirectory = downloadItem.filename.substring(0, downloadItem.filename.lastIndexOf(getBasename(downloadItem.filename)));

    const isMonitored = monitoredFolders.some(folder => {
        // Normalize both paths to use forward slashes and remove any trailing slash for a consistent, exact comparison.
        const normalize = (path) => path.replace(/\\/g, '/').replace(/\/$/, '');
        
        const normalizedDownloadDir = normalize(downloadDirectory);
        const normalizedMonitoredFolder = normalize(folder);

        return normalizedDownloadDir === normalizedMonitoredFolder;
    });

    if (!isMonitored) {
        console.log(`[Downloads Router] OnCreated: Download to directory '${downloadDirectory}' is not a monitored folder. Routing will not be applied.`);
        return;
    }

    // Proceed with routing logic immediately.
    let newPath = '';
    const suggest = (suggestion) => { newPath = suggestion.filename; };
    const order = JSON.parse(localStorage.getItem('dr_order')) || ['filename', 'referrer', 'mime'];
    order.every(rule => {
        if (rulesets[rule](downloadItem, suggest)) return false;
        return true;
    });

    if (newPath && newPath !== downloadItem.filename) {
        rerouting.add(downloadItem.url);
        chrome.downloads.cancel(downloadItem.id);
        chrome.downloads.erase({ id: downloadItem.id });
        chrome.downloads.download({
            url: downloadItem.url,
            filename: newPath
        }, () => {
            setTimeout(() => rerouting.delete(downloadItem.url), 500);
        });
    }
});

// --- SCRIPT INITIALIZATION ---
var version = localStorage.getItem('dr_version');
if(!version || version != chrome.runtime.getManifest().version) {
	chrome.tabs.create({ url: "options.html" });
	localStorage.setItem('dr_version', chrome.runtime.getManifest().version);
}
