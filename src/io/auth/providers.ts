import { m } from "../../paraglide/messages.js";
import { GITHUB_AUTHORIZE_PATH } from "../vendor/github/routes";

/**
 * The ways to sign in. The sign-in modal and the account page list these, so
 * another provider is a new entry here and in `providers.client.ts`, not new
 * markup. Safe to import from templates: nothing in here touches the DOM.
 */
export type AuthProviderId = "github";

export interface AuthProvider {
	id: AuthProviderId;
	/** brand name, not translated */
	name: string;
	/** what the connection is used for, on the account page */
	description: () => string;
	/** starts the sign-in, which comes back to `returnTo` */
	signInHref: (returnTo: string) => string;
	/** the account's public profile */
	profileHref: (login: string) => string;
	/** square avatar, `size` in css pixels */
	avatarSrc: (login: string, size: number) => string;
}

const github: AuthProvider = {
	id: "github",
	name: "GitHub",
	description: () => m.account_provider_github(),
	signInHref: (returnTo) =>
		`${GITHUB_AUTHORIZE_PATH}?${new URLSearchParams({ "return-to": returnTo })}`,
	profileHref: (login) => `https://github.com/${encodeURIComponent(login)}`,
	// twice the size for sharp avatars on high density screens
	avatarSrc: (login, size) =>
		`https://avatars.githubusercontent.com/${encodeURIComponent(login)}?s=${size * 2}`,
};

export const AUTH_PROVIDERS: readonly AuthProvider[] = [github];

export const authProvider = (id: string): AuthProvider | undefined =>
	AUTH_PROVIDERS.find((provider) => provider.id === id);
