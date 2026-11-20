/**
 * opens and closes the `<dialog>` components (Modal, Sheet) with attributes:
 * - `data-modal-open="<id>"` on a button opens the dialog with that id
 * - `data-modal-close` on a button inside a dialog closes it
 * - a click on the backdrop closes it
 *
 * one listener on the document covers every dialog, and pages swapped in later
 */
/** space between the sheet and what it opens under, as in the design */
const SHEET_GAP = 8;

/**
 * a sheet opens under the button in the page header: 8px below the button
 * when it sits in the header, otherwise 8px below the header, so the sheet
 * never cuts across it. without a header in view the CSS default applies
 */
const placeSheet = (sheet: HTMLDialogElement, opener: HTMLElement) => {
	const header = opener.closest("header") ?? document.querySelector("header");
	const anchor = header?.contains(opener) === true ? opener : header;
	const bottom = anchor?.getBoundingClientRect().bottom ?? 0;

	if (bottom > 0 && bottom < window.innerHeight / 2) {
		sheet.style.setProperty(
			"--ui-sheet-top",
			`${Math.round(bottom + SHEET_GAP)}px`,
		);
	} else {
		sheet.style.removeProperty("--ui-sheet-top");
	}
};

document.addEventListener("click", (event) => {
	const target = event.target;
	if (!(target instanceof Element)) {
		return;
	}

	const opener = target.closest("[data-modal-open]");
	if (opener instanceof HTMLElement) {
		const dialog = document.getElementById(opener.dataset["modalOpen"] ?? "");
		if (dialog instanceof HTMLDialogElement && !dialog.open) {
			if (dialog.matches(".ui-sheet")) {
				placeSheet(dialog, opener);
			}
			dialog.showModal();
		}
		return;
	}

	const closer = target.closest("[data-modal-close]");
	if (closer !== null) {
		closer.closest("dialog")?.close();
		return;
	}

	// a click on the dialog itself, not its content, landed on the backdrop.
	// padding is part of the dialog, so compare against its box
	if (
		target instanceof HTMLDialogElement &&
		target.matches(".ui-modal, .ui-sheet")
	) {
		const box = target.getBoundingClientRect();
		const inside =
			event.clientX >= box.left &&
			event.clientX <= box.right &&
			event.clientY >= box.top &&
			event.clientY <= box.bottom;
		if (!inside) {
			target.close();
		}
	}
});
