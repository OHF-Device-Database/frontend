/**
 * keeps every theme switch on the page (the menu, the footer) in step with the
 * chosen theme. a switch is a radio group inside `[data-theme-switch]` with the
 * values `auto`, `light` and `dark`
 */
type DemoState = {
	getTheme?: () => string;
	setTheme?: (theme: string) => void;
};
const demoState = () =>
	(window as unknown as { DemoState?: DemoState }).DemoState;

const SELECTOR = '[data-theme-switch] input[type="radio"]';

const show = (theme: string) => {
	for (const input of document.querySelectorAll<HTMLInputElement>(SELECTOR)) {
		input.checked = input.value === theme;
	}
};

document.addEventListener("change", (event) => {
	const input = event.target;
	if (input instanceof HTMLInputElement && input.matches(SELECTOR)) {
		demoState()?.setTheme?.(input.value);
		// from the choice itself, not the saved one: saving can fail, and the
		// theme on screen has changed either way
		show(input.value);
	}
});

// the page may be cached for everyone, so the saved theme is filled in here
const sync = () => {
	show(demoState()?.getTheme?.() ?? "auto");
};

document.addEventListener("astro:page-load", sync);
