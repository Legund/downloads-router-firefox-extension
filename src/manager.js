// =================================================================================
// Downloads Router - manager.js (Firefox-Compatible Version)
// =================================================================================

// Object to hold the different ruleset functions.
var rulesets = {};

/**
 * Helper function to get the basename of a path (the filename).
 * @param {string} path - The full path to the file.
 * @returns {string} The filename component of the path.
 */
function getBasename(path) {
    // Handles both forward (/) and back (\\) slashes.
    return path.substring(path.lastIndexOf('/') + 1).substring(path.lastIndexOf('\\') + 1);
}

// --- RULESET DEFINITIONS ---

/**
 * Filename-based routing rules.
 * @param {object} downloadItem - The download item object from the browser.
 * @param {function} suggest - The callback function to suggest a new path.
 * @returns {boolean} - True if a rule was matched, false otherwise.
 */
rulesets['filename'] = function(downloadItem, suggest) {
	console.debug("  [RULE] Checking 'filename' rules...");
	var filename_map = JSON.parse(localStorage.getItem('dr_filename_map'));
	if (!filename_map || Object.keys(filename_map).length === 0) {
		console.debug("    - No filename rules found.");
		return false;
	}

	for (var keyword in filename_map) {
		if (Object.prototype.hasOwnProperty.call(filename_map, keyword)) {
			var regex = new RegExp(keyword, 'i');

			if (regex.exec(downloadItem.filename) || regex.exec(downloadItem.url)) {
				const destination = filename_map[keyword];
				
				if (destination === './') {
					console.debug(`    ✓ MATCH on keyword '${keyword}'. Destination is './'.`);
					console.debug(`      - Explicitly keeping original path: '${downloadItem.filename}'`);
					suggest({ filename: downloadItem.filename, handled: true });
					return true; 
				} else if (destination) {
					const newPath = destination + getBasename(downloadItem.filename);
					console.debug(`    ✓ MATCH on keyword '${keyword}'.`);
					console.debug(`      - Original path: '${downloadItem.filename}'`);
					console.debug(`      - Routing to: '${newPath}'`);
					suggest({ filename: newPath, handled: false });
					return true;
				}
			}
		}
	}
	console.debug("    - No filename rules matched.");
	return false;
};

/**
 * Referrer-based routing rules.
 * @param {object} downloadItem - The download item object from the browser.
 * @param {function} suggest - The callback function to suggest a new path.
 * @returns {boolean} - True if a rule was matched, false otherwise.
 */
rulesets['referrer'] = function(downloadItem, suggest) {
	console.debug("  [RULE] Checking 'referrer' rules...");
	var ref_map = JSON.parse(localStorage.getItem('dr_referrer_map'));
    var ref_domain;

	var matches;
	if (downloadItem.referrer) {
		matches = downloadItem.referrer.match(/^https?\:\/\/([^\/:?#]+)(?:[\/:?#]|$)/i);
	} else {
		matches = downloadItem.url.match(/^https:\/\/([^\/:?#]+)(?:[\/:?#]|$)/i);
	}
	ref_domain = matches ? matches[1].replace(/^www\./i, '') : null;
	console.debug(`    - Determined referrer domain: ${ref_domain}`);

	if (ref_map && ref_domain && Object.prototype.hasOwnProperty.call(ref_map, ref_domain)) {
		const destination = ref_map[ref_domain];
		if (destination === './') {
			console.debug(`    ✓ MATCH on domain '${ref_domain}'. Destination is './'.`);
			console.debug(`      - Explicitly keeping original path: '${downloadItem.filename}'`);
			suggest({ filename: downloadItem.filename, handled: true });
			return true;
		} else if (destination) {
			const newPath = destination + getBasename(downloadItem.filename);
			console.debug(`    ✓ MATCH on domain '${ref_domain}'.`);
			console.debug(`      - Original path: '${downloadItem.filename}'`);
			console.debug(`      - Routing to: '${newPath}'`);
			suggest({ filename: newPath, handled: false });
			return true;
		}
	}

	if (JSON.parse(localStorage.getItem('dr_global_ref_folders'))) {
        if (ref_domain) {
			const newPath = ref_domain + '/' + getBasename(downloadItem.filename);
			console.debug(`    ✓ MATCH on global referrer rule.`);
			console.debug(`      - Original path: '${downloadItem.filename}'`);
			console.debug(`      - Routing to: '${newPath}'`);
		    suggest({ filename: newPath, handled: false });
		    return true;
        }
	}
	
	console.debug("    - No referrer rules matched.");
	return false;
};

/**
 * MIME type-based routing rules.
 * @param {object} downloadItem - The download item object from the browser.
 * @param {function} suggest - The callback function to suggest a new path.
 * @returns {boolean} - True if a rule was matched, false otherwise.
 */
rulesets['mime'] = function(downloadItem, suggest) {
	console.debug("  [RULE] Checking 'mime' rules...");
	var mime_map  = JSON.parse(localStorage.getItem('dr_mime_map'));
	if (!mime_map || Object.keys(mime_map).length === 0) {
		console.debug("    - No MIME rules found.");
		return false;
	}
	
	var mime_type = downloadItem.mime;
    let extension = '';

    const sourceForExt = downloadItem.filename.includes('.') ? downloadItem.filename : downloadItem.url;
    const matches = sourceForExt.match(/\.([0-9a-z]+)(?:[\?#]|$)/i);
    if (matches) {
        extension = matches[1].toLowerCase();
    }
	console.debug(`    - Original MIME: '${mime_type}', Inferred extension: '${extension}'`);

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
			console.debug(`    - Inferred MIME type '${mime_type}' from extension.`);
		}
	}

	const checkAndSuggest = (matchKey, matchType) => {
		if (Object.prototype.hasOwnProperty.call(mime_map, matchKey)) {
			const destination = mime_map[matchKey];
			if (destination === './') {
				console.debug(`    ✓ MATCH on ${matchType} '${matchKey}'. Destination is './'.`);
				console.debug(`      - Explicitly keeping original path: '${downloadItem.filename}'`);
				suggest({ filename: downloadItem.filename, handled: true });
				return true;
			} else if (destination) {
				const newPath = destination + getBasename(downloadItem.filename);
				console.debug(`    ✓ MATCH on ${matchType} '${matchKey}'.`);
				console.debug(`      - Original path: '${downloadItem.filename}'`);
				console.debug(`      - Routing to: '${newPath}'`);
				suggest({ filename: newPath, handled: false });
				return true;
			}
		}
		return false;
	};

	if (mime_type && checkAndSuggest(mime_type, 'MIME type')) {
		return true;
	}

	if (extension && checkAndSuggest(extension, 'extension')) {
		return true;
	}

	console.debug("    - No MIME rules matched.");
	return false;
};

// --- FIREFOX-COMPATIBLE IMPLEMENTATION ---

// This set keeps track of downloads we are actively rerouting to prevent loops.
const rerouting = new Set();

// METHOD 1: Intercept headers to reroute downloads before they start.
chrome.webRequest.onHeadersReceived.addListener(
    function(details) {
        // Get the latest rule order every time.
        const order = JSON.parse(localStorage.getItem('dr_order')) || ['filename', 'referrer', 'mime'];

        console.group(`[Downloads Router] Intercepting headers for: ${details.url}`);
        console.debug("  - Rule order:", order);
        let header = details.responseHeaders.find(h => h.name.toLowerCase() === 'content-disposition');
        
        // Only act on downloads.
        if (!header || !header.value.toLowerCase().includes('attachment')) {
            console.debug("  - Not a download attachment. Ignoring.");
            console.groupEnd();
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
            filename: originalFilename,
            url: details.url,
            referrer: details.initiator || details.originUrl,
            mime: mimeType
        };
        
        let suggestion = {};
        const suggest = (s) => { suggestion = s; };

        // Run the rules using the latest order.
        order.some(rule => rulesets[rule](simulatedDownloadItem, suggest));

        if (suggestion.filename && !suggestion.handled) {
			console.debug(`  - Rerouting via fallback to: "${suggestion.filename}"`);
			rerouting.add(downloadItem.url);
			chrome.downloads.cancel(downloadItem.id);
			chrome.downloads.erase({ id: downloadItem.id });


			let headerUrl;

			if (downloadItem.referrer) {
				headerUrl = downloadItem.referrer;
				console.debug(`  - Using browser-provided referrer: ${headerUrl}`);
			} else if (downloadItem.url) {
				try {
					const urlObject = new URL(downloadItem.url);
					headerUrl = urlObject.origin; // e.g., "https://gemini.google.com"
					console.debug(`  - No referrer found. Using URL origin as fallback: ${headerUrl}`);
				} catch (e) {
					console.error("  - Could not parse download URL to create fallback headers.", e);
				}
			}
			
			const downloadOptions = {
				url: downloadItem.url,
				filename: suggestion.filename,
				conflictAction: 'uniquify'
			};

			if (headerUrl) {
				downloadOptions.headers = [
					{ name: 'Referer', value: headerUrl },
					{ name: 'Origin', value: headerUrl } 
				];
			}

			chrome.downloads.download(downloadOptions, (downloadId) => {
				if (chrome.runtime.lastError) {
					console.error(`  - Fallback download failed: ${chrome.runtime.lastError.message}`);
				} else {
					console.debug(`  - Fallback download initiated with ID: ${downloadId}`);
				}
				setTimeout(() => rerouting.delete(downloadItem.url), 1000);
			});
		} else {
			console.debug("  - No rules matched or './' rule was used. Allowing original download.");
		}

        console.groupEnd();
        return { responseHeaders: details.responseHeaders };
    },
    { urls: ["<all_urls>"], types: ["main_frame", "sub_frame", "other"] },
    ["blocking", "responseHeaders"]
);

// METHOD 2: Fallback for downloads not caught by the header listener.
chrome.downloads.onCreated.addListener(function(downloadItem) {
    // If we already handled this via headers, do nothing.
    if (rerouting.has(downloadItem.url)) {
        rerouting.delete(downloadItem.url);
        return;
    }
    
    // Get the latest rule order every time.
    const order = JSON.parse(localStorage.getItem('dr_order')) || ['filename', 'referrer', 'mime'];

    console.group(`[Downloads Router] Fallback check for created download: ${downloadItem.filename}`);
    console.debug("  - Rule order:", order);

    const monitoredFolders = JSON.parse(localStorage.getItem('dr_monitored_folders')) || [];
    if (!monitoredFolders.length) {
        console.debug("  - No monitored folders configured. Fallback routing will not be applied.");
        console.groupEnd();
        return;
    }

    const downloadDirectory = downloadItem.filename.substring(0, downloadItem.filename.lastIndexOf(getBasename(downloadItem.filename)));
    const normalize = (path) => path.replace(/\\/g, '/').replace(/\/$/, '');
    
    const isMonitored = monitoredFolders.some(folder => {
        return normalize(downloadDirectory) === normalize(folder);
    });

    if (!isMonitored) {
        console.debug(`  - Download to directory '${downloadDirectory}' is not monitored. Ignoring.`);
        console.groupEnd();
        return;
    }

    let suggestion = {};
    const suggest = (s) => { suggestion = s; };
    
    // Run the rules using the latest order.
    order.some(rule => rulesets[rule](downloadItem, suggest));

    if (suggestion.filename && !suggestion.handled) {
		console.debug(`  - Rerouting via fallback to: "${suggestion.filename}"`);
		rerouting.add(downloadItem.url);
		chrome.downloads.cancel(downloadItem.id);
		chrome.downloads.erase({ id: downloadItem.id });

		let referrerUrl = downloadItem.referrer;

		if (!referrerUrl && downloadItem.url) {
			// Find the last '/' in the URL to get the 'directory' path
			const lastSlashIndex = downloadItem.url.lastIndexOf('/');
			if (lastSlashIndex > 0) {
				referrerUrl = downloadItem.url.substring(0, lastSlashIndex + 1);
				console.debug(`  - No referrer found. Constructed fallback referrer: ${referrerUrl}`);
			}
		}
		
		const downloadOptions = {
			url: downloadItem.url,
			filename: suggestion.filename,
			conflictAction: 'uniquify' 
		};

		// Only add the Referer header if we have a valid URL for it.
		if (referrerUrl) {
			downloadOptions.headers = [{
				name: 'Referer',
				value: referrerUrl
			}];
		}

		chrome.downloads.download(downloadOptions, () => {
			setTimeout(() => rerouting.delete(downloadItem.url), 1000);
		});
	} else {
        console.debug("  - No rules matched or './' rule was used. Allowing original download.");
    }
    
    console.groupEnd();
});

// --- SCRIPT INITIALIZATION ---
// On first install or update, open the options page.
var version = localStorage.getItem('dr_version');
if(!version || version != chrome.runtime.getManifest().version) {
	chrome.tabs.create({ url: "options.html" });
	localStorage.setItem('dr_version', chrome.runtime.getManifest().version);
}
