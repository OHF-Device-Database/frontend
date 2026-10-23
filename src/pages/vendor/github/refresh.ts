import {
	GITHUB_OAUTH_CLIENT_ID,
	GITHUB_OAUTH_CLIENT_SECRET,
} from "astro:env/server";
import type { APIRoute } from "astro";

import { SESSION_CHANGE_HEADERS } from "../../../io/oauth";
import {
	GITHUB_COOKIE_REFRESH,
	GitHubOAuth,
} from "../../../io/vendor/github/oauth";
import { GITHUB_COOKIE_USER } from "../../../io/vendor/github/session";

export const prerender = false;

const status = (code: number, headers: Record<string, string> = {}): Response =>
	new Response(null, {
		status: code,
		headers: { "cache-control": "no-store", ...headers },
	});

/** trades the refresh token for a new access token */
export const POST: APIRoute = async ({ cookies, url }) => {
	if (!GITHUB_OAUTH_CLIENT_ID || !GITHUB_OAUTH_CLIENT_SECRET) {
		return status(503);
	}

	const refreshToken = cookies.get(GITHUB_COOKIE_REFRESH)?.value;
	if (typeof refreshToken === "undefined") {
		GitHubOAuth.session.clear(cookies);
		return status(401, SESSION_CHANGE_HEADERS);
	}

	try {
		const token = await GitHubOAuth.token.refresh({
			clientId: GITHUB_OAUTH_CLIENT_ID,
			clientSecret: GITHUB_OAUTH_CLIENT_SECRET,
			refreshToken,
		});

		// account name missing, re-authentication required
		const login = cookies.get(GITHUB_COOKIE_USER)?.value;
		if (typeof login === "undefined") {
			GitHubOAuth.session.clear(cookies);
			return status(401, SESSION_CHANGE_HEADERS);
		}

		GitHubOAuth.session.write({ url, token, login }, cookies);

		return status(204);
	} catch {
		// a refresh token is single-use, re-authentication required
		GitHubOAuth.session.clear(cookies);

		return status(401, SESSION_CHANGE_HEADERS);
	}
};
