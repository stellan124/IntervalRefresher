chrome.runtime.onInstalled.addListener(() => {
    // setting up storage
    chrome.storage.sync.set({"sites": []}, () => {
        console.log("Created sites collection");
    });
});
/**
 * Cleans the specified url to allow for easier relation between saved urls and live urls
 * @param url
 * @returns {string}
 */
let cleanUrl = (url) => {
    // credits to https://stackoverflow.com/questions/41942690/removing-http-or-http-and-www/41942787
    return url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
};
/**
 * Determines what site, if any, corresponds with the supplied url.
 * @param url - the unedited URL to use for the site search
 * @returns corresponding site or null if no site is located
 */
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

let current_tab = -1;
let sites_array = []; // [obj(Site),...]
/**
 * Syncs the background page's local sites collection(sites_array) with chrome storage sync
 */
let fetchSites = () => {
    chrome.storage.sync.get("sites", (result) => {
        sites_array = result.sites;
    });
};
fetchSites();


/**
 * Test if the supplied object contains the proper fields and data types
 * @returns {boolean} - true if obj is a valid Site
 */
let isSiteObj = (obj) => {
    if ("label" in obj && "address" in obj && "interval" in obj) {
        return typeof (obj.label) === "string" && typeof (obj.address) === "string" && typeof (obj.interval) === "number";
    }
    return false;
};

let TabTimer = class {
    timer_id = -1;
    start_time = -1;
    running = false;

    callback = () => {
        console.log("Timer needs callback")
    };
    site = null;
    tab_id = -1;

    /**
     * A timer that can be associated with a site and tab which allows for custom callback functionality.
     * @param {number} tab_id - The identifier for the tab this timer corresponds with
     * @param site - the site associated with this timer
     * @param callback - the function to execute on completion of this timer
     */
    constructor(tab_id, site, callback) {
        // timer scope should be an instance of TimerController
        this.tab_id = tab_id;
        this.site = site;
        this.callback = callback;
    }

    /**
     * Starts the timer if it has not already started(this.running == false).
     */
    start() {
        if (!this.running) {
            this.running = true;
            let self = this; // avoid setTimeout scope issue
            this.timer_id = window.setTimeout(() => {
                self.callback();
                self.reset();
            }, this.site.interval * 1000);
            this.start_time = Date.now();
        }
    }

    /**
     * Stops the timer if it has been started.
     */
    stop() {
        if (this.running && this.timer_id !== -1) {
            window.clearTimeout(this.timer_id);
            this.running = false;
        }
    }

    /**
     * Resets the timer to its pre-start conditions. Maintains this.site and this.tab_id values.
     */
    reset() {
        this.running = false;
        this.timer_id = -1;
        this.start_time = -1;
    }
};

let SitesTimerController = class {
    timers_tabs = new Map(); // {tabId(int): obj(TabTimer),...} tab:timer == 1:1
    timers_sites = new Map(); // {obj(Site): [t1(TabTimer),...],...} site:timer == 1:n
    /**
     * Consolidates tabTimers under one object to allow for simpler timer queueing and deletion as
     * well as easier association between timers and sites/tabs.
     */
    constructor() {
    }

    /**
     * Starts a timer for the specified tab and site.
     * @param {number} tab_id - the identifier for the target tab
     * @param site - an object that is successfully validated by the isSiteObj function
     * @param {boolean} refresh_focused - determines if page is to be refreshed while focused
     */
    startTimer(tab_id, site, refresh_focused = true) {
        let self = this;
        let callback;
        if (refresh_focused) {
            callback = () => {
                console.log(tab_id);
                chrome.tabs.reload(tab_id);
                self.stopTimerTab(tab_id);
                console.log(Date.now() - t.start_time, "ms");
            }
        } else {
            callback = () => {
                console.log(tab_id);
                if (tab_id !== current_tab) {
                    chrome.tabs.reload(tab_id);
                }
                self.stopTimerTab(tab_id);
                console.log(Date.now() - t.start_time, "ms");
            }
        }
        let t = new TabTimer(tab_id, site, callback);
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

    /**
     * Stops the timers corresponding with the supplied tab id.
     * @param {number} tab_id - identifier for referencing a tab
     * @returns {boolean}
     */
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

    /**
     * Stops all timers corresponding to the supplied site.
     * @param site - represents the site which needs its corresponding timers halted
     * @returns {boolean}
     */
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


let timer_controller = new SitesTimerController();

/**
 * Stores the supplied site object in chrome sync storage.
 * @param site - an object as validated by the isSiteObj function
 * @returns {Promise<boolean>} - determines if successfullly stored
 */
let storeSite = async (site) => {
    // assumes sites_array is in sync with chrome.storage.sync
    if (isSiteObj(site)) {
        sites_array.push(site);
        await chrome.storage.sync.set({"sites": sites_array});
        return true;
    }
    return false;
};

/**
 * Removes a site from chrome sync storage if the supplied site is found.
 * @param site - represents the site to remove
 * @returns {Promise<boolean>} - determines if the site was successfully removed from chrome sync storage
 */
let removeStoredSite = async (site) => {
    // assumes sites_array is in sync with chrome.storage.sync
    if (isSiteObj(site)) {
        for (let i = 0; i < sites_array.length; i++) {
            let current = sites_array[i];
            if (current.address === site.address && current.label === site.label && current.interval === site.interval) {
                sites_array.splice(i, 1);
                await chrome.storage.sync.set({"sites": sites_array}, () => {
                    timer_controller.stopTimerSite(site);
                });
                return true;
            }
        }
    }
    return false;
};

/**
 * Replaces an existing site in chrome storage sync with a different site object.
 * @param original_site - represents the site to replace
 * @param updated_site - represents the site which will take the original_site's place
 * @returns {Promise<boolean>} - determines if successfully replaced the site
 */
let updateStoredSite = async (original_site, updated_site) => {
    if (isSiteObj(updated_site)) {
        for (let i = 0; i < sites_array.length; i++) {
            let current = sites_array[i];
            if (current.address === original_site.address && current.label === original_site.label && current.interval === original_site.interval) {
                sites_array[i] = updated_site;
                await chrome.storage.sync.set({"sites": sites_array});
                return true;
            }
        }
    }
    return false;
};

let handleStorageMessage = async (msg) => {
    let success = false;
    if (msg.operation === "store_site") {
        success = await storeSite(msg.data)
    } else if (msg.operation === "remove_site") {
        success = await removeStoredSite(msg.data);
    } else if (msg.operation === "update_site") {
        success = await updateStoredSite(msg.data.original, msg.data.new)
    }
    return success;
};

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    console.log("Received Message", message, sender);
    if (message.type === "storage") {
        sendResponse({"success": await handleStorageMessage(message)});
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
