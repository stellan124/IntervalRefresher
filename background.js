chrome.runtime.onInstalled.addListener(function() {
	// setting up storage
    chrome.storage.sync.set({"sites": []}, function() {
		console.log("Created sites collection");
	});
});


let sites = [];
let refreshSites = async() => {
		chrome.storage.sync.get("sites", function(result) {
		sites = result.sites;
	});
};
refreshSites();

let cleanUrl = (url) => {
	// credits to https://stackoverflow.com/questions/41942690/removing-http-or-http-and-www/41942787
	return url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0]; 
};

let getSite = (url) => {
	let clean_url = cleanUrl(url);
	console.log(sites);
	for (i = 0; i < sites.length; i++) {
		if (sites[i].address.indexOf(clean_url) == 0) {
			return sites[i];
		}
	}
	return null;
};
chrome.storage.sync.onChanged.addListener(function(changes, areaName) {
	console.log("Storage updated", changes);
	refreshSites();
});

let timers = {}; // holds {tabId: {timer: setTimeout ref, url},...}
let startTimer = (tabId, url, seconds) => {
	// returns true if timer started otherwise false
	if (tabId in timers) {
		return false;
	}
	let timer = setTimeout(function() {
				// refreshes page and removes from timers
				if (tabId in timers) {
					delete timers[tabId];
				}
				chrome.tabs.reload(tabId);
		}, seconds * 1000);
	timers[tabId] = {"timer": timer, "url": url};
	return true;	
};

let removeTimer = (tabId) => {
	// true if timer cleared, otherwise false
	if (tabId in timers) {
		let t = timers[tabId];
		clearTimeout(t.timer);
		delete timers[tabId];
		return true;
	}
	return false;
};

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
	// if url changes check for and kill existing timers
	if (tab.status == "complete" && "url" in tab) {
		console.log("-=-=-=-=-Page Change-=-=-=-=-=-");
		console.log("Tab ID:", tabId);
		if (tabId in timers) {
			let existing_timer = timers[tabId];
			if (existing_timer.url != tab.url) {
				removeTimer(tabId);
			}
		}
		// check if new page has a matching site
		let site = getSite(tab.url, sites);
		if (site != null) {
			startTimer(tabId, tab.url, site.interval);
			console.log("Started timer for", tab, site.interval, "secs");
		}
		console.log("Timers", timers);
	}
});

chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
	if (tabId in timers) {
		console.log("Closed tab", tabId);
		removeTimer(tabId);
		console.log("Timers", timers);
	}
});
