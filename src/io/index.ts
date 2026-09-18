import { z } from "astro/zod";

import { exactlyOne } from "../types/exactly-one";

const REQUEST_TIMEOUT_MS = 8000;
let SERVER_API_AUTHORITY: string | undefined;
if (import.meta.env.SSR) {
	({ API_AUTHORITY: SERVER_API_AUTHORITY } = await import("astro:env/server"));
}

declare global {
	interface Window {
		/** set by `/config.js`, see `src/pages/config.js.ts` */
		__API_AUTHORITY__?: string;
	}
}

// resolved per call rather than at module evaluation, so the island bundle
// never depends on `/config.js` having run before it was imported
const apiAuthority = (): string => {
	const authority = import.meta.env.SSR
		? SERVER_API_AUTHORITY
		: window.__API_AUTHORITY__;

	if (typeof authority === "undefined") {
		throw new Error("API authority is not configured");
	}

	return authority;
};

export const ioBaseUrl = (): string => {
	const authority = apiAuthority();

	return /^https?:\/\//.test(authority) ? authority : `https://${authority}`;
};

export class IoError extends Error {
	constructor(
		public path: string | URL,
		public status: number,
		public received?: string | undefined,
	) {
		super(`got <${status}> while fetching <${path}>`);
		Object.setPrototypeOf(this, IoError.prototype);
	}
}

type NeverIfAnyNever<T extends Record<string, unknown>> = true extends {
	[K in keyof T]: [T[K]] extends [never] ? true : false;
}[keyof T]
	? never
	: T;

/** ensures that header names are consistently lower-cased   */
type FetchDecoderInputHeaders<H> = NeverIfAnyNever<{
	[K in keyof H]: K extends Lowercase<K & string> ? string[] : never;
}>;

type FetchDecoder<
	InputBody,
	InputHeaders extends FetchDecoderInputHeaders<InputHeaders>,
	OutputBody,
	OutputHeaders,
> = {
	decode: (data: { body: InputBody; headers: InputHeaders }) => {
		body: OutputBody;
		headers: InputHeaders extends never ? never : OutputHeaders;
	};
};

/** intentionally resolves to `never` when header names are not lower-cased */
export const ioFetch = async <
	InputBody,
	InputHeaders extends FetchDecoderInputHeaders<InputHeaders>,
	OutputBody,
	OutputHeaders,
>(
	path: string | URL,
	decoder: FetchDecoder<InputBody, InputHeaders, OutputBody, OutputHeaders>,
	searchParams?: URLSearchParams,
	accept: "application/json" | "text/plain" = "application/json",
	signal?: AbortSignal,
): Promise<{ body: OutputBody; headers: OutputHeaders }> => {
	const url = typeof path === "string" ? new URL(path, ioBaseUrl()) : path;
	if (searchParams) {
		url.search = searchParams.toString();
	}

	const res = await fetch(url, {
		headers: { accept },
		signal: signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});

	if (!res.ok) {
		throw new IoError(
			path,
			res.status,
			await res.text().catch(() => undefined),
		);
	}

	let body: unknown;
	switch (accept) {
		case "application/json":
			body = await res.json();
			break;
		case "text/plain":
			body = await res.text();
			break;
	}

	return decoder.decode({
		body: body as InputBody,
		headers: [...res.headers.entries()].reduce<Record<string, string[]>>(
			(acc, [key, value]) =>
				Object.assign(acc, {
					[key.toLowerCase()]: [...(acc[key.toLowerCase()] ?? []), value],
				}),
			{},
		) as InputHeaders,
	});
};

export const searchParameters = (
	query: Record<string, number | string | Iterable<string> | Iterable<number>>,
): URLSearchParams => {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (typeof value === "string" || typeof value === "number") {
			params.set(key, String(value));
		} else {
			for (const item of value) {
				params.append(key, String(item));
			}
		}
	}

	return params;
};

export const IoHeaderLink = z
	.string()
	.transform((header, ctx) => {
		const entries = header.split(/,\s*(?=<)/).map((part) => {
			const match = part.match(/^<(?<url>[^>]+)>;\s*rel="(?<rel>[^"]+)"$/);
			if (!match?.groups) {
				ctx.addIssue({
					code: "custom",
					message: `invalid link header segment <${part}>`,
				});
				return z.NEVER;
			}
			return [match.groups.rel, match.groups.url] as const;
		});
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- pipe below ensures shape
		return Object.fromEntries(entries);
	})
	.pipe(
		z.object({
			first: z.string(),
			last: z.string(),
			next: z.string().optional(),
		}),
	);

export const IoHeaderContentRange = (unit: string) =>
	z.string().transform((value, ctx) => {
		const match = value.match(
			/^(?<unit>\w+)\s+(?<start>\d+)-(?<end>\d+)\/(?<total>\d+)$/,
		);
		if (!match?.groups) {
			ctx.addIssue({
				code: "custom",
				message: `invalid content-range header <${value}>`,
			});
			return z.NEVER;
		}
		if (match.groups.unit !== unit) {
			ctx.addIssue({
				code: "custom",
				message: `expected unit "${unit}", got "${match.groups.unit}"`,
			});
			return z.NEVER;
		}
		const { start, end, total } = match.groups;
		return {
			start: Number(start),
			end: Number(end),
			total: Number(total),
		};
	});

export const IoHeadersCaching = z.object({
	"cache-control": z.optional(
		exactlyOne(
			z.string().transform((value) => {
				const match = value.match(/max-age=(?<maxAge>\d+)/);
				return {
					maxAge: match?.groups?.maxAge
						? Number(match.groups.maxAge)
						: undefined,
				};
			}),
		),
	),
	"last-modified": z.optional(exactlyOne(z.coerce.date())),
});
export type IoHeadersCaching = z.infer<typeof IoHeadersCaching>;
