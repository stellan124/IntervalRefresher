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

// chrome storage management
// stores a single site s
//      s format is identical to getFormData output
let storeSite = (s) => {
    chrome.storage.sync.get("sites", function (result) {
        let sites = result.sites;
        sites.push(s);
        chrome.storage.sync.set({"sites": sites}, function () {
        });
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
            if (sites[i].toString() == s_str) {
                found_site = true;
                sites.splice(i, 1);
                break;
            }
        }
        if (found_site) {
            chrome.storage.sync.set({"sites": sites}, function () {
            })
        }
    })
};


// form and table management
let getFormData = () => {
    let label_input = $("#siteLabelInput")[0];
    let address_input = $("#siteAddressInput")[0];
    let interval_picker = $("#siteIntervalPicker")[0];
    return {
        "label": label_input.value,
        "address": cleanUrl(address_input.value),
        "interval": parseInt(interval_picker.value)
    };
};

let clearForm = () => {
    $("#siteLabelInput")[0].value = "";
    $("#siteAddressInput")[0].value = "";
    $("#siteIntervalPicker").data("durationPicker").setValue(0);
};

// s is output of getFormData
//      s = {"label": str, "address": str, "interval": int}
// returns 1 if data is valid, 2 if bad url, 3 if bad interval
let checkFormData = () => {
    let site = getFormData();
    let clean_url = cleanUrl(site.address);
    if (clean_url.length == 0 || !isValidUrl(clean_url)) {
        return 2; // invalid url
    }
    if (site.interval <= 0) {
        return 3; // invalid interval
    }
    return 1;
};

// adds a site to the sites table, no databasing
// s is output of getFormData
//      s = {"label": str, "address": str, "interval": int}
let addSite = (s) => {
    let new_row = $("#sitesTable > tbody")[0].insertRow(-1);

    // site label, first column
    new_row.insertCell(0).appendChild(document.createTextNode(s.label));

    // site address, second column
    new_row.insertCell(1).appendChild(document.createTextNode(s.address));

    // site interval
    let interval_str = secondsToString(s.interval);
    new_row.insertCell(2).appendChild(document.createTextNode(interval_str));

    let remove_btn = document.createElement("BUTTON");
    remove_btn.className = "btn btn-secondary";
    remove_btn.innerHTML = "-";
    remove_btn.addEventListener("click", function (e) {
        $("#sitesTable")[0].deleteRow(e.target.parentElement.parentElement.rowIndex);
        removeStoredSite(s);
    });
    new_row.insertCell(3).appendChild(remove_btn);
};


$(document).ready(function () {
    $(".duration-picker").durationPicker({
        showSeconds: true,
        showDays: false
    });

    $("#addSiteButton").click(function () {
        let form_state = checkFormData();
        if (form_state == 1) {
            let site_data = getFormData();
            storeSite(site_data);
            addSite(site_data);
            clearForm();
        } else if (form_state == 2) {
            alert("Invalid URL, cannot add site.")
        } else if (form_state == 3) {
            alert("Invalid Interval, cannot add site.")
        }
    });

    chrome.storage.sync.get("sites", function (result) {
        let sites = result.sites;
        sites.forEach(function (entry, index, array) {
            console.log(entry);
            addSite(entry);
        });
    });
});
