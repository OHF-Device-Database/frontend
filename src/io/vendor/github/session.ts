import { GITHUB_AUTHORIZE_PATH } from "./routes";
import type {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used in comment
	GITHUB_SIGN_OUT_PATH,
} from "./routes";

export const GITHUB_COOKIE_USER = "github-user";
export const GITHUB_COOKIE_TOKEN = "github-token";

/** fired on `window` whenever the token is renewed, lost or signed out */
export const GITHUB_EVENT_SESSION = "github-session-change";

/**
 * Treat a token that is about to expire as expired: a request started inside
 * this window would likely come back 401, and renewing first is cheaper than
 * failing and retrying.
 */
const EXPIRY_SKEW_MS = 60_000;

export interface GitHubToken {
	token: string;
	scope: string;
	/** epoch milliseconds, from the server's clock */
	expiresAt: number;
}

const cookieValue = (name: string): string | undefined => {
	for (const part of document.cookie.split(";")) {
		const separator = part.indexOf("=");
		if (separator > 0 && part.slice(0, separator).trim() === name) {
			const raw = part.slice(separator + 1);

			try {
				return decodeURIComponent(raw);
			} catch {
				// a stray `%` makes decoding throw; the value is unusable either way
				return raw;
			}
		}
	}

	return undefined;
};

const expireCookie = (name: string): void => {
	const secure = window.location.protocol === "https:" ? "; secure" : "";

	document.cookie = `${name}=; path=/; max-age=0; samesite=lax${secure}`;
};

const isToken = (value: unknown): value is GitHubToken => {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const candidate = value as Partial<Record<keyof GitHubToken, unknown>>;

	return (
		typeof candidate.token === "string" &&
		typeof candidate.scope === "string" &&
		typeof candidate.expiresAt === "number"
	);
};

/**
 * The session as the page sees it: what the cookies say, what to do when they
 * stop saying it, and the way back to a new one.
 */
export class GitHubSession {
	static readonly token = {
		read: (): GitHubToken | undefined => {
			const raw = cookieValue(GITHUB_COOKIE_TOKEN);
			const token = GitHubSession.token.deserialize(raw);

			// expire token that could not be parsed
			if (typeof raw !== "undefined" && typeof token === "undefined") {
				expireCookie(GITHUB_COOKIE_TOKEN);
			}

			return token;
		},

		deserialize: (
			serialized: string | undefined,
			now: number = Date.now(),
		): GitHubToken | undefined => {
			if (!serialized) {
				return undefined;
			}

			let parsed: unknown;
			try {
				parsed = JSON.parse(serialized);
			} catch {
				return undefined;
			}

			if (!isToken(parsed)) {
				return undefined;
			}

			return parsed.expiresAt - EXPIRY_SKEW_MS <= now ? undefined : parsed;
		},
	};

	/** account name, outlives token */
	static login(): string | undefined {
		return cookieValue(GITHUB_COOKIE_USER);
	}

	/** lets every part of the page react to a session that changed underneath it */
	static announce(): void {
		window.dispatchEvent(new CustomEvent(GITHUB_EVENT_SESSION));
	}

	/**
	 * marks client-accessible cookies as expired and dispatches event
	 * non-client accessible cookies can be cleared through the {@link GITHUB_SIGN_OUT_PATH} route
	 */
	static forget(): void {
		expireCookie(GITHUB_COOKIE_USER);
		expireCookie(GITHUB_COOKIE_TOKEN);

		GitHubSession.announce();
	}

	/** leaves the page; the callback brings the visitor back to `returnTo`, signed in */
	static signIn(
		returnTo: string = window.location.pathname + window.location.search,
	): void {
		const url = new URL(GITHUB_AUTHORIZE_PATH, window.location.origin);
		url.searchParams.set("return-to", returnTo);

		window.location.assign(url.toString());
	}
}
