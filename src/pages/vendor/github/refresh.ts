import {
	GITHUB_OAUTH_CLIENT_ID,
	GITHUB_OAUTH_CLIENT_SECRET,
} from "astro:env/server";
import type { APIRoute } from "astro";

import {
	GITHUB_COOKIE_REFRESH,
	GitHubOAuth,
} from "../../../io/vendor/github/oauth";
import { GITHUB_COOKIE_USER } from "../../../io/vendor/github/session";

export const prerender = false;

const status = (code: number): Response =>
	new Response(null, {
		status: code,
		headers: { "cache-control": "no-store" },
	});

/** trades the refresh token for a new access token */
export const POST: APIRoute = async ({ cookies, url }) => {
	if (
		typeof GITHUB_OAUTH_CLIENT_ID === "undefined" ||
		typeof GITHUB_OAUTH_CLIENT_SECRET === "undefined"
	) {
		return status(503);
	}

	const refreshToken = cookies.get(GITHUB_COOKIE_REFRESH)?.value;
	if (typeof refreshToken === "undefined") {
		GitHubOAuth.session.clear(cookies);
		return status(401);
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
			return status(401);
		}

		GitHubOAuth.session.write({ url, token, login }, cookies);

		return status(204);
	} catch {
		// a refresh token is single-use, re-authentication required
		GitHubOAuth.session.clear(cookies);

		return status(401);
	}
};
