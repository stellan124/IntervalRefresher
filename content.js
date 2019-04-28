console.log("Interval Refresher Loaded")

let getPageLabel = () => {
	chrome.storage.sync.get("addresses", function(result) {
		let u = document.URL;
	});
};

// should support wild card(*) addresses
async function getSiteIndex() {
	let site_index = -203;
	await chrome.storage.sync.get("addresses", function(result) {
		let site_index = -1;
		let addresses = result["addresses"];
		for (i = 0; i < addresses.length; i++) {
			let wild_card_index = addresses[i].indexOf("*")
			if (wild_card_index != -1) {
				let cleaned = addresses[i].substring(0,wild_card_index)
				if (document.URL.indexOf(cleaned) == 0) {
					site_index = i;
					break;
				}
			}
		}
		console.log(site_index);
	});
	return site_index;	
}

async function checkAndStartTimer() {
	let site_index = await getSiteIndex();
	if (site_index == -1) {
		return false;
	}
	console.log(document.URL);
	console.log(site_index)
}

let requestTimerStart = () => {
	chrome.runtime.sendMessage({"data_type": "page_reloaded", "data": document.URL});
};

checkAndStartTimer();

// reacts to timers in background script
chrome.runtime.onMessage.addListener(function(message) {
	if (message.data_type == "refresh_page") {
		location.reload();
	}
});
