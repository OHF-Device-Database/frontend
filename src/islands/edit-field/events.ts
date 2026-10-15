/** for edits that don't come from a native control, fire what one would */
export const notifyChange = (target: EventTarget | null): void => {
	target?.dispatchEvent(new Event("input", { bubbles: true }));
	target?.dispatchEvent(new Event("change", { bubbles: true }));
};
