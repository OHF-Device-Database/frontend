/**
 * shows that a control's action is running: marks it busy, disables it if it
 * is a button and swaps the text in its `[data-label]` for `label`. the button
 * stays focusable, so the caller ignores clicks while `aria-busy` is set.
 * returns a function that puts the control back
 */
export const markBusy = (control: HTMLElement, label: string): (() => void) => {
	const text = control.querySelector("[data-label]");
	const original = text?.textContent ?? "";
	const button = control instanceof HTMLButtonElement;

	// not `disabled`, which would drop the keyboard focus to <body>
	if (button) control.setAttribute("aria-disabled", "true");
	control.setAttribute("aria-busy", "true");
	if (text) text.textContent = label;

	return () => {
		if (button) control.removeAttribute("aria-disabled");
		control.removeAttribute("aria-busy");
		if (text) text.textContent = original;
	};
};
