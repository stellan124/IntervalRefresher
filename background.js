chrome.runtime.onInstalled.addListener(() => {
    // setting up storage
    chrome.storage.sync.set({"sites": []}, () => {
        console.log("Created sites collection");
    });
});

let current_tab = -1;
let sites_array = []; // [obj(Site),...]
let fetchSites = () => {
    chrome.storage.sync.get("sites", (result) => {
        sites_array = result.sites;
    });
};
fetchSites();


let Site = class {
    label;
    address;
    interval;

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

    callback = () => {
        console.log("Timer needs callback")
    };
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
        this.timer_id = window.setTimeout(() => {
            self.callback();
            self.reset();
        }, this.site.interval * 1000);
        this.start_time = Date.now();
        this.running = false;
    }

    stop() {
        window.clearTimeout(this.timer_id);
        this.running = false;
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
        let t = new TabTimer(tab_id, site, () => {
            console.log(tab_id);
            if (tab_id !== current_tab) {
                chrome.tabs.reload(tab_id);
            }
            self.stopTimerTab(tab_id);
            console.log(Date.now() - t.start_time, "ms");
        });
        t.start();
        // update timer collections
        if (tab_id in this.timers_tabs) {
            this.stopTimerTab(tab_id);
        }
        this.timers_tabs.set(tab_id, t);
        if (site in this.timers_sites) {
            let stimers = sites_array.get(site);
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
            this.timers_sites[site].forEach((t) => {
                t.stop();
                this.timers_tabs.delete(t.tab_id);
            });
            this.timers_sites.delete(site);
            return true;
        }
        return false;
    }
};

let cleanUrl = (url) => {
    // credits to https://stackoverflow.com/questions/41942690/removing-http-or-http-and-www/41942787
    return url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
};

let matchUrl = (url) => {
    let clean_url = cleanUrl(url);
    console.log(sites_array);
    for (let i = 0; i < sites_array.length; i++) {
        if (sites_array[i].address.indexOf(clean_url) === 0) {
            return sites_array[i];
        }
    }
    return null;
};

// chrome storage management
// stores a single site s
//      s format is identical to getFormData output
let storeSite = (s) => {
    // assumes sites_array is in sync with chrome.storage.sync
    sites_array.push(s);
    chrome.storage.sync.set({"sites": sites_array});
};

// remove a single site that matches s (via toString comparison)
//      s format is identical to getFormData output
let removeStoredSite = (s) => {
    // assumes sites_array is in sync with chrome.storage.sync
    for (let i = 0; i < sites_array.length; i++) {
        let current = sites_array[i];
        if (current.address === s.address && current.label === s.label && current.interval === s.interval) {
            sites_array.splice(i, 1);
            chrome.storage.sync.set({"sites": sites_array});
            break;
        }
    }
};

let timer_controller = new SitesTimerController();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Received Message", message, sender);
    if (message.type === "store_site") {
        storeSite(message.data);
        sendResponse({"success": true});
    } else if (message.type === "remove_site") {
        removeStoredSite(message.data);
        sendResponse({"success": true});
    } else {
        sendResponse({"success": false});
    }
});

chrome.storage.sync.onChanged.addListener((changes) => {
    console.log("Storage updated", changes);
    if ("sites" in changes) {
        sites_array = changes.sites.newValue;
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // if url changes check for and kill existing timers
    if (tab.status === "complete" && "url" in tab) {
        console.log("-=-=-=-=-Page Change-=-=-=-=-=-");
        console.log("Tab ID:", tabId);
        // check if new page has a matching site
        let site = matchUrl(tab.url, sites_array);
        if (site != null) {
            timer_controller.startTimer(tabId, site);
            console.log("Started timer for", tab, site.interval, "secs");
        }
        console.log("Timers", timer_controller.timers_tabs);
    }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
    console.log("Activated Tab", activeInfo);
    current_tab = activeInfo.tabId;
});

chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId in timer_controller.timers_tabs) {
        console.log("Closed tab", tabId);
        timer_controller.stopTimerTab(tabId);
        console.log("Timers", timers);
    }
});
