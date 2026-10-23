import type {
	ValidationIssue,
	ValidationPhoto,
	ValidationPhotoSlot,
} from "./types";

/** empty slots are valid, as fields are optional */
export const validatePhotos = (
	photos: ValidationPhoto[],
	slots: ValidationPhotoSlot[],
): ValidationIssue[] =>
	photos.flatMap((photo, slot): ValidationIssue[] => {
		if (photo === null) {
			return [];
		}
		if (!photo.type.startsWith("image/")) {
			return [{ code: "photo-type", slot }];
		}
		const rule = slots[slot];
		const allowed =
			photo.category !== "" &&
			(rule?.constrained !== true || rule.categories.includes(photo.category));

		return allowed ? [] : [{ code: "photo-category", slot }];
	});
