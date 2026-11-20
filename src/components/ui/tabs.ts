/**
 * moves the line under the current tab when a tab points at a section of the
 * same page (`href="#section"`). the browser doesn't reload for those, so the
 * server can't mark the new one. tabs that link to other pages are left alone:
 * the next page renders its own current tab
 *
 * one listener on the document covers every tab bar, and pages swapped in later
 */
const mark = (tab: Element) => {
	for (const other of tab.closest(".ui-tabs")?.querySelectorAll(".ui-tab") ??
		[]) {
		if (other === tab) {
			other.setAttribute("aria-current", "location");
		} else {
			other.removeAttribute("aria-current");
		}
	}
};

document.addEventListener("click", (event) => {
	const target = event.target;
	if (!(target instanceof Element)) {
		return;
	}

	const tab = target.closest(".ui-tabs .ui-tab");
	if (tab?.getAttribute("href")?.startsWith("#") === true) {
		mark(tab);
	}
});

// a page opened with a section in the address starts on that tab
const syncToAddress = () => {
	if (location.hash === "") {
		return;
	}

	for (const tab of document.querySelectorAll(".ui-tabs .ui-tab")) {
		if (tab.getAttribute("href") === location.hash) {
			mark(tab);
		}
	}
};

syncToAddress();
window.addEventListener("hashchange", syncToAddress);
