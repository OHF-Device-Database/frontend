export const GITHUB_ROUTE_BASE = "/vendor/github";

export const GITHUB_AUTHORIZE_PATH = `${GITHUB_ROUTE_BASE}/authorize`;
export const GITHUB_CALLBACK_PATH = `${GITHUB_ROUTE_BASE}/callback`;
export const GITHUB_REFRESH_PATH = `${GITHUB_ROUTE_BASE}/refresh`;
export const GITHUB_SIGN_OUT_PATH = `${GITHUB_ROUTE_BASE}/sign-out`;

/** the grant itself, as a resource: `DELETE` revokes it at GitHub */
export const GITHUB_AUTHORIZATION_PATH = `${GITHUB_ROUTE_BASE}/authorization`;
