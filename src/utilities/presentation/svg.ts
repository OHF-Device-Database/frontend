import { generic, render } from ".";

import { PresentationRenderPresetRoleIcon } from "./preset";

/** icon as an svg string by generic name or renderable, usable without lit */
export const iconSvg = (
	self: Parameters<typeof generic>[0] | Parameters<typeof render>[0],
	size = 16,
): string =>
	render(
		typeof self === "string" ? generic(self) : self,
		PresentationRenderPresetRoleIcon.withSize(size),
	);
