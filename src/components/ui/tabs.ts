/**
 * moves the line under the current tab when a tab points at a section of the
 * same page (`href="#section"`). the browser doesn't reload for those, so the
 * server can't mark the new one. tabs that link to other pages are left alone:
 * the next page renders its own current tab
 *
 * one listener on the document covers every tab bar, and pages swapped in later
 */
const DEFAULT = "data-ui-tab-default";

const tabsOf = (bar: Element) => bar.querySelectorAll(".ui-tab");

/** remembers which tab the server marked, once, so it can be restored */
const remember = (bar: Element) => {
	if (bar.hasAttribute(DEFAULT)) {
		return;
	}

	const index = [...tabsOf(bar)].findIndex((tab) =>
		tab.hasAttribute("aria-current"),
	);
	bar.setAttribute(DEFAULT, String(index));
};

const isSection = (tab: Element) =>
	tab.getAttribute("href")?.startsWith("#") === true;

const mark = (bar: Element, current: Element | undefined) => {
	for (const tab of tabsOf(bar)) {
		if (tab === current) {
			// a section of this page is a `location`, another page is a `page`
			tab.setAttribute("aria-current", isSection(tab) ? "location" : "page");
		} else {
			tab.removeAttribute("aria-current");
		}
	}
};

/** lines every tab bar up with the section in the address */
const syncToAddress = () => {
	for (const bar of document.querySelectorAll(".ui-tabs")) {
		const tabs = [...tabsOf(bar)];
		if (!tabs.some(isSection)) {
			continue;
		}

		remember(bar);

		const match =
			location.hash === ""
				? undefined
				: // `hash` is encoded the same way on both, so `#café` matches
					tabs.find(
						(tab) =>
							isSection(tab) &&
							tab instanceof HTMLAnchorElement &&
							tab.hash === location.hash,
					);
		// no section in the address, or one this bar doesn't have:
		// back to the tab the server marked
		mark(bar, match ?? tabs[Number(bar.getAttribute(DEFAULT))]);
	}
};

document.addEventListener("click", (event) => {
	// only a plain click moves this page. with a modifier key or another
	// mouse button the link opens somewhere else
	if (
		event.defaultPrevented ||
		event.button !== 0 ||
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.altKey ||
		!(event.target instanceof Element)
	) {
		return;
	}

	const tab = event.target.closest(".ui-tabs .ui-tab");
	const bar = tab?.closest(".ui-tabs");
	if (tab != null && bar != null && isSection(tab)) {
		remember(bar);
		mark(bar, tab);
	}
});

syncToAddress();
window.addEventListener("hashchange", syncToAddress);
window.addEventListener("popstate", syncToAddress);
// the client router swaps pages in without a `hashchange`
document.addEventListener("astro:page-load", syncToAddress);
