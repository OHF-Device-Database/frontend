/**
 * shows that a control's action is running: marks it busy, disables it if it
 * is a button and swaps the text in its `[data-label]` for `label`.
 * returns a function that puts the control back
 */
export const markBusy = (control: HTMLElement, label: string): (() => void) => {
	const text = control.querySelector("[data-label]");
	const original = text?.textContent ?? "";

	if (control instanceof HTMLButtonElement) control.disabled = true;
	control.setAttribute("aria-busy", "true");
	if (text) text.textContent = label;

	return () => {
		if (control instanceof HTMLButtonElement) control.disabled = false;
		control.removeAttribute("aria-busy");
		if (text) text.textContent = original;
	};
};
