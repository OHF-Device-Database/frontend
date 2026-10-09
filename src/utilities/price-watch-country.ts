// kept apart from the provider data so the client bundle only carries what the picker needs
import type { PriceWatchCountry } from "./price-watch";

export const PRICE_WATCH_STORAGE_KEY = "device-database.priceWatchCountry.v1";

/**
 * main time zones per supported country, keyed by country so a new one fails to compile without zones
 * approximate as missed zone only means no preselection
 */
export const priceWatchTimeZones = {
	at: ["Europe/Vienna"],
	au: [
		"Australia/Adelaide",
		"Australia/Brisbane",
		"Australia/Darwin",
		"Australia/Hobart",
		"Australia/Melbourne",
		"Australia/Perth",
		"Australia/Sydney",
	],
	be: ["Europe/Brussels"],
	ca: [
		"America/Edmonton",
		"America/Halifax",
		"America/Regina",
		"America/St_Johns",
		"America/Toronto",
		"America/Vancouver",
		"America/Winnipeg",
	],
	ch: ["Europe/Zurich"],
	cz: ["Europe/Prague"],
	de: ["Europe/Berlin"],
	dk: ["Europe/Copenhagen"],
	es: ["Atlantic/Canary", "Europe/Madrid"],
	fi: ["Europe/Helsinki"],
	fr: ["Europe/Paris"],
	gb: ["Europe/London"],
	hu: ["Europe/Budapest"],
	it: ["Europe/Rome"],
	jp: ["Asia/Tokyo"],
	nl: ["Europe/Amsterdam"],
	no: ["Europe/Oslo"],
	nz: ["Pacific/Auckland"],
	pl: ["Europe/Warsaw"],
	se: ["Europe/Stockholm"],
	sk: ["Europe/Bratislava"],
} as const satisfies Record<PriceWatchCountry, readonly string[]>;

const countries = new Map<string, PriceWatchCountry>(
	(
		Object.entries(priceWatchTimeZones) as [
			PriceWatchCountry,
			readonly string[],
		][]
	).flatMap(([country, zones]) => zones.map((zone) => [zone, country])),
);

/** guesses a supported country from an IANA time zone, hardened browsers report UTC and get no guess */
export const guessPriceWatchCountry = (
	timeZone: string,
): PriceWatchCountry | undefined => countries.get(timeZone);
