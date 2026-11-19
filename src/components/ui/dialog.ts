/**
 * opens and closes the `<dialog>` components (Modal, Sheet) with attributes:
 * - `data-modal-open="<id>"` on a button opens the dialog with that id
 * - `data-modal-close` on a button inside a dialog closes it
 * - a click on the backdrop closes it
 *
 * one listener on the document covers every dialog, and pages swapped in later
 */
document.addEventListener("click", (event) => {
	const target = event.target;
	if (!(target instanceof Element)) {
		return;
	}

	const opener = target.closest("[data-modal-open]");
	if (opener instanceof HTMLElement) {
		const dialog = document.getElementById(opener.dataset["modalOpen"] ?? "");
		if (dialog instanceof HTMLDialogElement && !dialog.open) {
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
