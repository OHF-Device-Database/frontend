import { baseLocale, isLocale, locales } from "../paraglide/runtime.js";
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
