chrome.runtime.onInstalled.addListener(function() {
	// setting up storage
    chrome.storage.sync.set({"sites": []}, function() {
		console.log("Created sites collection");
	});
});

let Site = class {
	constructor(label, address, interval) {
		this.label = label;
		this.address = address;
		this.interval = interval;
	}
};

// TODO make existing timers update on change of interval or removal of site
let TabTimer = class {
	timer_id = -1;
	start_time = -1;
	running = false;


	callback = function(){console.log("Timer needs callback")};
	site = null;
	tab_id = -1;

	constructor(tab_id, site, callback) {
		// timer scope should be an instance of TimerController
		this.tab_id = tab_id;
		this.site = site;
		this.callback = callback;
	}

	start() {
		this.running = true;
		let self = this; // avoid setTimeout scope issue
		this.timer_id = window.setTimeout(function () {
			self.callback();
			self.reset();
		}, this.site.interval * 1000);
		this.start_time = Date.now();
		this.running = true;
	}

	stop() {
		window.clearTimeout(this.timer_id);
	}

	reset() {
		this.running = false;
		this.timer_id = -1;
		this.start_time = -1;
	}
};

let SitesTimerController = class {
	constructor() {
		this.timers_tabs = new Map(); // {tabId(int): obj(TabTimer),...} tab:timer == 1:1
		this.timers_sites = new Map(); // {obj(Site): [t1(TabTimer),...],...} site:timer == 1:n
	}

	startTimer(tab_id, site) {
		let self = this;
		let t = new TabTimer(tab_id, site, function() {
			chrome.tabs.reload(this.tab_id);
			self.stopTimerTab(tab_id);
			console.log(Date.now() - t.start_time, "ms");
		});
		t.start();
		// update timer collections
		if(tab_id in this.timers_tabs) {
			this.stopTimerTab(tab_id);
		}
		this.timers_tabs.set(tab_id, t);
		if (site in this.timers_sites) {
			let stimers = sites.get(site);
			stimers.push(t);
			this.timers_sites.set(site, stimers);
		} else {
			this.timers_sites.set(site, [t]);
		}
	}

	stopTimerTab(tab_id) {
		// tab_id(int), site(Site)
		// tab_id or site must be specified
		if (this.timers_tabs.has(tab_id)) {
			let t = this.timers_tabs.get(tab_id);
			t.stop();
			// remove from tabs map
			this.timers_tabs.delete(t.tab_id);
			// remove from sites map
			let stimers = this.timers_sites.get(t.site);
			console.log("Stimers", stimers);
			let stimer_index = stimers.indexOf(t);
			if (stimer_index !== -1) {
				console.log(stimers);
				stimers.splice(stimer_index, 1);
				console.log(stimers);
				if (stimers.length === 0) {
					this.timers_sites.delete(t.site);
				} else {
					this.timers_sites.set(t.site, stimers);
				}
			}
			return true;
		}
		return false; // timer not found
	}

	stopTimerSite(site) {
		if (site in this.timers_sites) {
			this.timers_sites[site].forEach(function(t){
				t.stop();
				this.timers_tabs.delete(t.tab_id);
			});
			this.timers_sites.delete(site);
			return true;
		}
		return false;
	}
};

let sites = []; // [obj(Site),...]
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

let matchUrl = (url) => {
	let clean_url = cleanUrl(url);
	console.log(sites);
	for (i = 0; i < sites.length; i++) {
		if (sites[i].address.indexOf(clean_url) === 0) {
			return sites[i];
		}
	}
	return null;
};
chrome.storage.sync.onChanged.addListener(function(changes, areaName) {
	console.log("Storage updated", changes);
	refreshSites();
});

let timer_controller = new SitesTimerController();

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
	// if url changes check for and kill existing timers
	if (tab.status === "complete" && "url" in tab) {
		console.log("-=-=-=-=-Page Change-=-=-=-=-=-");
		console.log("Tab ID:", tabId);
		// check if new page has a matching site
		let site = matchUrl(tab.url, sites);
		if (site != null) {
			timer_controller.startTimer(tabId, site);
			console.log("Started timer for", tab, site.interval, "secs");
		}
		console.log("Timers", timer_controller.timers_tabs);
	}
});

chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
	if (tabId in timers) {
		console.log("Closed tab", tabId);
		timer_controller.stopTimerTab(tabId);
		console.log("Timers", timers);
	}
});
