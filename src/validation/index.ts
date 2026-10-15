// returns structured issues instead of messages, consumers localize them

export { validateEan } from "./ean";
export { unsetAllowed, validateOption, validateUnset } from "./option";
export { validatePhotos } from "./photos";
export { validateText } from "./text";
export type {
	ValidationIssue,
	ValidationIssueCode,
	ValidationPhoto,
	ValidationPhotoSlot,
	ValidationTextLength,
	ValidationTextPattern,
} from "./types";
