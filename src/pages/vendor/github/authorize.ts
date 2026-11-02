import { GITHUB_OAUTH_CLIENT_ID } from "astro:env/server";
import type { APIRoute } from "astro";

import { safeReturnTo } from "../../../io/oauth";
import {
	GITHUB_COOKIE_OAUTH_HELLO,
	GitHubOAuth,
} from "../../../io/vendor/github/oauth";
import { GITHUB_CALLBACK_PATH } from "../../../io/vendor/github/routes";

export const prerender = false;

/**
 * starts the oauth web flow
 * sits beside `/callback` so that csrf state can be tightly scoped
 */
export const GET: APIRoute = ({ cookies, url }) => {
	if (!GITHUB_OAUTH_CLIENT_ID) {
		return new Response("github oauth is not configured\n", {
			status: 503,
			headers: { "content-type": "text/plain; charset=utf-8" },
		});
	}

	const state = crypto.randomUUID();

	cookies.set(
		GITHUB_COOKIE_OAUTH_HELLO,
		{ state, returnTo: safeReturnTo(url.searchParams.get("return-to")) },
		GitHubOAuth.authorize.cookieOptions(url),
	);

	const redirectUri = new URL(GITHUB_CALLBACK_PATH, url).toString();

	return new Response(null, {
		status: 302,
		headers: {
			location: GitHubOAuth.authorize.url({
				clientId: GITHUB_OAUTH_CLIENT_ID,
				redirectUri,
				state,
			}),
			"cache-control": "no-store",
		},
	});
};
