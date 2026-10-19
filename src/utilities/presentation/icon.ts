import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { iconSvg } from "./svg";

/** icon as a lit template part, by generic name or renderable */
export const icon = (...args: Parameters<typeof iconSvg>) =>
	unsafeHTML(iconSvg(...args));
