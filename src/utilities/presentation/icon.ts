import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { generic, render } from ".";

import { PresentationRenderPresetRoleIcon } from "./preset";

/** icon as a lit template part, by generic name or renderable */
export const icon = (
	self: Parameters<typeof generic>[0] | Parameters<typeof render>[0],
	size = 16,
) =>
	unsafeHTML(
		render(
			typeof self === "string" ? generic(self) : self,
			PresentationRenderPresetRoleIcon.withSize(size),
		),
	);
