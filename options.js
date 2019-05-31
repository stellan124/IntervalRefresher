// TODO make sites table row class to associate
// utilities
// converts seconds(int) to a string of form dd:hh:mm:ss
let stringPad = (s, pad_char, length) => {
    let new_str = s;
    while (new_str.length < length) {
        new_str = pad_char + new_str;
    }
    return new_str;
};

let secondsToString = (s) => {
    let seconds = s;
    let days = Math.floor(seconds / 86400);
    seconds -= (days * 86400);

    let hours = Math.floor(seconds / 3600);
    seconds -= (hours * 3600);

    let minutes = Math.floor(seconds / 60);
    seconds -= (minutes * 60);

    let time_strs = [days, hours, minutes, seconds];
    for (i = 0; i < time_strs.length; i++) {
        time_strs[i] = stringPad(time_strs[i].toString(10), "0", 2);
    }
    return time_strs.join(":");
};

	// assumes dd:hh:mm:ss format of tstr
let timeStringToSeconds = (tstr) => {
	let tsplit = tstr.split(":");
	let total_seconds = parseInt(tsplit[0]) * 86400; // days to seconds
	total_seconds += parseInt(tsplit[1]) * 3600; // hours to seconds
	total_seconds += parseInt(tsplit[2]) * 60; // minutes to seconds
	total_seconds += parseInt(tsplit[3]); // seconds
	return total_seconds;
};

//credits to https://stackoverflow.com/questions/5717093/check-if-a-javascript-string-is-a-url
let isValidUrl = (str) => {
    var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
        '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
    return !!pattern.test(str);
};

// removes http(s) and www. prefixes from urls
// credits to https://stackoverflow.com/questions/41942690/removing-http-or-http-and-www/41942787
let cleanUrl = (url) => {
    return url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "");
};

let Site = class {
    constructor(label, address, interval) {
        this.label = label;
        this.address = address;
        this.interval = interval;
    }
	toString() {
		return this.label + "," + this.address + "," + this.interval;
	}
};

// chrome storage management
// stores a single site s
//      s format is identical to getFormData output
let storeSite = (s) => {
    chrome.storage.sync.get("sites", function (result) {
        let sites = result.sites;
        sites.push(s);
        chrome.storage.sync.set({"sites": sites}, function () {});
    });
};

// remove a single site that matches s (via toString comparison)
//      s format is identical to getFormData output
let removeStoredSite = (s) => {
    // TODO emit message to stop corresponding timers
    let s_str = s.toString();
    chrome.storage.sync.get("sites", function (result) {
        let found_site = false;
        let sites = result.sites;
        for (i = 0; i < sites.length; i++) {
            if (sites[i].toString() === s_str) {
                found_site = true;
                sites.splice(i, 1);
                break;
            }
        }
        if (found_site) {
            chrome.storage.sync.set({"sites": sites}, function () {
            });
        }
    });
};


// form and table management
let getFormData = () => {
    let label_input = $("#siteLabelInput")[0];
    let address_input = $("#siteAddressInput")[0];
    let interval_picker = $("#siteIntervalPicker")[0];
    return new Site(label_input.value, cleanUrl(address_input.value), parseInt(interval_picker.value));
};

let clearForm = () => {
    $("#siteLabelInput")[0].value = "";
    $("#siteAddressInput")[0].value = "";
    let interval_picker = $("#siteIntervalPicker");
    interval_picker[0].reset();
};

// s is output of getFormData
//      s(Site)
// returns 1 if data is valid, 2 if bad url, 3 if bad interval
let checkFormData = () => {
    let site = getFormData();
    let clean_url = cleanUrl(site.address);
    if (clean_url.length === 0 || !isValidUrl(clean_url)) {
        return 2; // invalid url
    }
    if (site.interval <= 0) {
        return 3; // invalid interval
    }
    return 1;
};

let getRowSite = (index) => {
	// gets the Site object of the specified row
	let sites_table_rows = $("#sitesTable > tbody > tr");
	if (!index in sites_table_rows) {
		console.log("Not present");
		return null;
	}
	let row_cells = sites_table_rows[index].getElementsByTagName("td");
	console.log(row_cells);	
	let label = row_cells[0].innerHTML;
	let address = row_cells[1].innerHTML;
	let interval = timeStringToSeconds(row_cells[2].innerHTML);
	
	return new Site(label, address, interval);
};

// adds a site to the sites table, no databasing
// s is output of getFormData
//      s = {"label": str, "address": str, "interval": int}
let addSite = (s, tindex=-1) => {
    let new_row = $("#sitesTable")[0].insertRow(tindex);

    // site label, first columns
    new_row.insertCell(0).appendChild(document.createTextNode(s.label));

    // site address, second column
    new_row.insertCell(1).appendChild(document.createTextNode(s.address));

    // site interval
    let interval_str = secondsToString(s.interval);
    new_row.insertCell(2).appendChild(document.createTextNode(interval_str));
	
	// edit site button
	let edit_btn = document.createElement("button");
	edit_btn.className = "btn btn-secondary";
    edit_btn.addEventListener("click", function (e) {
        console.log("clicked edit", e);
    });
	let edit_btn_icon = document.createElement("I");
	edit_btn_icon.className = "fa fa-cog";
	edit_btn.appendChild(edit_btn_icon);
	
	// remove site button
    let remove_btn = document.createElement("button");
    remove_btn.className = "btn btn-secondary w-25 h-25";
    remove_btn.addEventListener("click", function (e) {
		let row_index;
		console.log("Tag", e.srcElement.tagName);
		// handling if button or icon are clicked
		if (e.srcElement.tagName === "svg") {
			row_index = e.srcElement.parentElement.parentElement.parentElement.rowIndex;
			console.log("svg pressed", row_index);
		} else {
			row_index = e.srcElement.parentElement.parentElement.rowIndex;
			console.log("btn pressed", row_index);
		}
        console.log(e);
		console.log(row_index, s);
        $("#sitesTable")[0].deleteRow(row_index);
		removeStoredSite(s);
	});
	let remove_btn_icon = document.createElement("I");
	remove_btn_icon.className = "fa fa-minus";
	remove_btn_icon.addEventListener("click", function(e) {
		e.stopPropagation();
	});
	remove_btn.appendChild(remove_btn_icon);
	
			
    let btn_cell = new_row.insertCell(3);
	btn_cell.appendChild(edit_btn);
	btn_cell.appendChild(remove_btn);
	console.log("s", s.toString());
};


$(document).ready(function () {
    $("#addSiteButton").click((e) => {
        let form_state = checkFormData();
        if (form_state === 1) {
            let site_data = getFormData();
            storeSite(site_data);
            addSite(site_data);
            clearForm();
        } else if (form_state === 2) {
            alert("Invalid URL, cannot add site.")
        } else if (form_state === 3) {
            alert("Invalid Interval, cannot add site.")
        }
    });
	
	$("#editSiteModal").on("shown.bs.modal", function(e) {
		console.log("Opened Modal");
		console.log(e);
	});
	
    chrome.storage.sync.get("sites", function (result) {
        let sites = result.sites;
        sites.forEach(function (entry, index, array) {
            console.log(entry);
            addSite(entry);
        });
		$("#sitesTable > tbody > tr> td:nth-child(4) > button:nth-child(1)").click((e) => {
			console.log("Clicked Edit");
			console.log(e);
		});
    });
});
