import Fuse from "fuse.js";
import { html } from "lit";
import type { TemplateResult } from "lit";

const OPTIONS = {
	ignoreDiacritics: true,
	ignoreLocation: true,
	includeMatches: true,
	includeScore: true,
	threshold: 0.3,
} as const;

const tokens = (term: string): string[] =>
	term.split(/\s+/).filter((token) => token.length > 0);

/**
 * fuzzy, word-order independent filtering. ranks by amount of matched term
 * words, then by match quality, then by count. an empty term keeps every item
 */
export const rank = <T extends { count?: number | undefined }>(
	items: readonly T[],
	term: string,
	label: (item: T) => string,
): T[] => {
	const byCount = (a: T, b: T) => (b.count ?? 0) - (a.count ?? 0);
	const query = tokens(term);
	if (query.length === 0) {
		return items.toSorted(byCount);
	}

	return (
		new Fuse(items, { ...OPTIONS, keys: [{ name: "label", getFn: label }] })
			.search({ $or: query.map((token) => ({ label: token })) })
			// ponytail: scores bucketed to tenths so that count decides between
			// similarly good matches, a weighted blend if this ranks poorly
			.toSorted(
				(a, b) =>
					(b.matches?.length ?? 0) - (a.matches?.length ?? 0) ||
					Math.round((a.score ?? 0) * 10) - Math.round((b.score ?? 0) * 10) ||
					byCount(a.item, b.item),
			)
			.map(({ item }) => item)
	);
};

/**
 * moves term words naming exactly one category (prefix, typo or accent
 * tolerant) into a category selection, as the api is unaware of translations
 */
export const extractCategories = <Id extends string>(
	term: string,
	categories: readonly { id: Id; label: string }[],
): { term: string; category: Set<Id> } => {
	const fuse = new Fuse(
		categories.flatMap(({ id, label }) =>
			tokens(label).map((word) => ({ id, word })),
		),
		// distance 0 anchors matches at word start, "leak" shouldn't hit "cleaning".
		// stricter than ranking, as a wrong category silently hides results:
		// "nest" shouldn't hit "networking"
		{
			keys: ["word"],
			ignoreDiacritics: true,
			includeScore: true,
			distance: 0,
			threshold: 0.25,
		},
	);
	// only the best matches compete: exact "weather" beats fuzzy "water".
	// four letter words must match exactly, "nest" shouldn't hit "networking"
	const search = (token: string) => {
		const results = fuse.search(token);
		const top = Math.min(...results.map(({ score }) => score ?? 1));
		return results.filter(
			({ score }) =>
				(score ?? 1) <= top + 0.05 && (token.length >= 5 || (score ?? 1) < 0.1),
		);
	};
	// short words are mostly conjunctions ("and", "und", "y")
	const candidates = tokens(term).map(
		(token) =>
			[
				token,
				new Set(
					token.length >= 4 ? search(token).map(({ item }) => item.id) : [],
				),
			] as const,
	);
	const category = new Set(
		candidates.flatMap(([, ids]) => (ids.size === 1 ? [...ids] : [])),
	);

	return {
		// also drops ambiguous words of an extracted category ("climate control")
		term: candidates
			.filter(([, ids]) => ![...ids].some((id) => category.has(id)))
			.map(([token]) => token)
			.join(" "),
		category,
	};
};

/**
 * wraps one segment per term word in `<mark>`: its first occurrence when typed
 * as is, else the longest segment of the typo tolerant match
 */
export const highlight = (
	text: string,
	term: string,
): (string | TemplateResult)[] => {
	const ranges = tokens(term)
		.flatMap((token): (readonly [number, number])[] => {
			const at = text.toLowerCase().indexOf(token.toLowerCase());
			if (at !== -1) {
				return [[at, at + token.length - 1]];
			}
			const { isMatch, indices } = Fuse.match(token, text, OPTIONS);
			const longest = indices?.toSorted(([a, b], [c, d]) => d - c - (b - a))[0];
			return isMatch && typeof longest !== "undefined" ? [longest] : [];
		})
		.toSorted(([a], [b]) => a - b);

	const parts: (string | TemplateResult)[] = [];
	let at = 0;
	for (const [start, end] of ranges) {
		if (end < at) {
			continue;
		}
		const from = Math.max(start, at);
		parts.push(
			text.slice(at, from),
			html`<mark>${text.slice(from, end + 1)}</mark>`,
		);
		at = end + 1;
	}
	parts.push(text.slice(at));

	return parts;
};
