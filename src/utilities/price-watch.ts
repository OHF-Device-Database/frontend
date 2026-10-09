export type PriceWatcher = {
	name: string;
	url: URL;
	template: (term: string) => URL;
};

type Search = (base: URL) => (term: string) => URL;

/** for price-watchers that need query parameter substitution, `path` is relative to the homepage */
const parameter =
	(path: string, name: string): Search =>
	(base) =>
	(term) => {
		const url = new URL(path, base);
		url.searchParams.set(name, term);
		return url;
	};

/** for price-watchers that need the term as a path segment, optionally wrapped by `format` */
const path =
	(prefix: string, format = (segment: string) => segment): Search =>
	(base) =>
	(term) =>
		new URL(prefix + format(encodeURIComponent(term)), base);

/** the search resolves against the homepage, so each host is written once */
const watcher = (
	name: string,
	homepage: string,
	search: Search,
): PriceWatcher => {
	const url = new URL(homepage);
	return { name, url, template: search(url) };
};

export const priceWatchers = {
	// iso 3166-1 alpha-2 country code
	at: [
		watcher("Geizhals", "https://geizhals.at", parameter("/", "fs")),
		watcher(
			"idealo",
			"https://www.idealo.at",
			parameter("/preisvergleich/MainSearchProductCategory.html", "q"),
		),
	],
	au: [
		watcher(
			"GetPrice",
			"https://www.getprice.com.au",
			// expects a lowercase slug, spaces would cut the search at the first word
			path("/search/", (segment) =>
				segment.replaceAll("%20", "-").toLowerCase(),
			),
		),
	],
	be: [
		watcher("Kelkoo", "https://fr.kelkoo.be", parameter("/ni/search", "mots")),
		watcher(
			"Tweakers Pricewatch",
			"https://tweakers.net",
			parameter("/zoeken/", "keyword"),
		),
	],
	ca: [
		watcher("Shopbot", "https://www.shopbot.ca", parameter("/search.php", "q")),
	],
	ch: [
		watcher(
			"Toppreise",
			"https://www.toppreise.ch",
			parameter("/produktsuche", "q"),
		),
	],
	cz: [
		watcher("Heureka", "https://www.heureka.cz", parameter("/", "h[fraze]")),
	],
	de: [
		watcher("Geizhals", "https://geizhals.de", parameter("/", "fs")),
		watcher(
			"idealo",
			"https://www.idealo.de",
			parameter("/preisvergleich/MainSearchProductCategory.html", "q"),
		),
	],
	dk: [
		watcher(
			"PriceRunner",
			"https://www.pricerunner.dk",
			parameter("/results", "q"),
		),
	],
	es: [
		watcher(
			"idealo",
			"https://www.idealo.es",
			parameter("/resultados.html", "q"),
		),
		watcher(
			"Kelkoo",
			"https://www.kelkoo.es",
			parameter("/ni/buscar", "consulta"),
		),
	],
	fi: [watcher("Hintaseuranta.fi", "https://hintaseuranta.fi", path("/haku/"))],
	fr: [
		watcher(
			"idealo",
			"https://www.idealo.fr",
			parameter("/prechcat.html", "q"),
		),
		watcher(
			"leDénicheur",
			"https://ledenicheur.fr",
			parameter("/search", "query"),
		),
	],
	gb: [
		watcher(
			"idealo",
			"https://www.idealo.co.uk",
			parameter("/mscat.html", "q"),
		),
		watcher(
			"PriceSpy",
			"https://pricespy.co.uk",
			parameter("/search", "query"),
		),
	],
	hu: [
		watcher(
			"Árukereső",
			"https://www.arukereso.hu",
			parameter("/CategorySearch.php", "st"),
		),
	],
	it: [
		watcher(
			"idealo",
			"https://www.idealo.it",
			parameter("/risultati.html", "q"),
		),
		watcher(
			"Trovaprezzi",
			"https://www.trovaprezzi.it",
			parameter("/categoria.aspx?id=-1", "libera"),
		),
	],
	jp: [
		watcher(
			"Kakaku.com",
			"https://kakaku.com",
			// search lives on a subdomain, an absolute prefix overrides the homepage
			path("https://search.kakaku.com/", (segment) => `${segment}/`),
		),
	],
	nl: [
		watcher(
			"Beslist",
			"https://www.beslist.nl",
			path("/products/r/", (segment) => `${segment}/`),
		),
		watcher(
			"Tweakers Pricewatch",
			"https://tweakers.net",
			parameter("/zoeken/", "keyword"),
		),
	],
	no: [
		watcher(
			"Prisjakt",
			"https://www.prisjakt.no",
			parameter("/search", "query"),
		),
	],
	nz: [
		watcher(
			"PriceSpy",
			"https://pricespy.co.nz",
			parameter("/search", "query"),
		),
	],
	pl: [
		watcher(
			"Ceneo",
			"https://www.ceneo.pl",
			// scoped to the smart home category
			path("/Inteligentny_dom;szukaj-"),
		),
	],
	se: [
		watcher(
			"PriceRunner",
			"https://www.pricerunner.se",
			parameter("/results", "q"),
		),
		watcher(
			"Prisjakt",
			"https://www.prisjakt.nu",
			parameter("/search", "query"),
		),
	],
	sk: [
		watcher("Heureka", "https://www.heureka.sk", parameter("/", "h[fraze]")),
	],
} as const satisfies Record<string, readonly PriceWatcher[]>;

export type PriceWatchCountry = keyof typeof priceWatchers;

export const priceWatchSearchTerm = (device: {
	manufacturer: string;
	model?: string | undefined;
	modelId?: string | undefined;
}): string =>
	`${device.manufacturer} ${device.model ?? device.modelId ?? ""}`.trim();

/** strips the `www.` prefix for display */
export const priceWatcherDomain = (watcher: PriceWatcher): string =>
	watcher.url.hostname.replace(/^www\./, "");

/** supported countries with localized names, sorted by name */
export const priceWatchCountries = (locale: string) => {
	const names = new Intl.DisplayNames([locale], { type: "region" });

	return (Object.keys(priceWatchers) as PriceWatchCountry[])
		.map((code) => ({
			code,
			name: names.of(code.toUpperCase()) ?? code.toUpperCase(),
			watchers: priceWatchers[code].toSorted((a, b) =>
				a.name.localeCompare(b.name, locale, { sensitivity: "base" }),
			),
		}))
		.toSorted((a, b) => a.name.localeCompare(b.name, locale));
};

export const priceWatchSuggestUrl = "https://forms.gle/ch2ohjc9F845tHA68";
