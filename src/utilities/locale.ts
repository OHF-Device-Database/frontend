import { AsyncLocalStorage } from "node:async_hooks";

import {
	baseLocale,
	isLocale,
	locales,
	overwriteServerAsyncLocalStorage,
	serverAsyncLocalStorage,
} from "../paraglide/runtime.js";
import type { Locale } from "../paraglide/runtime.js";

/** `getStaticPaths` for pages under `src/pages/[...locale]/`: the base locale is unprefixed */
export const localeStaticPaths = () =>
	locales.map((locale) => ({
		params: { locale: locale === baseLocale ? undefined : locale },
	}));

/** resolves the `[...locale]` route param, `undefined` when it isn't a valid locale prefix */
export const localeFromParam = (
	param: string | undefined,
): Locale | undefined => {
	if (typeof param === "undefined") {
		return baseLocale;
	}

	return isLocale(param) && param !== baseLocale ? param : undefined;
};

// Paraglide's per-render store
export interface LocaleStore {
	locale?: Locale;
	origin?: string;
	messageCalls?: Set<string>;
}

export interface LocaleStorage {
	run: <R>(store: LocaleStore, callback: () => R) => R;
}

// Paraglide lazily creates its AsyncLocalStorage on the first request.
// at build time that never happens, so register one ourselves when missing.
// `serverAsyncLocalStorage` and `overwriteServerAsyncLocalStorage` are
// Paraglide internals, `test/locale.test.ts` guards against them changing.
export const localeStorage = (): LocaleStorage => {
	if (typeof serverAsyncLocalStorage !== "undefined") {
		return serverAsyncLocalStorage;
	}

	const created = new AsyncLocalStorage<LocaleStore>();
	overwriteServerAsyncLocalStorage(created);

	return created;
};
