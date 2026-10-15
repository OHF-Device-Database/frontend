import type { z } from "astro/zod";

import {
	IoDeclaration,
	IoDeclarationPickerResource,
} from "../../io/declaration";
import type {
	IoDeclarationLocalized,
	IoDeclarationPhotos,
	IoDeclarationPhotosSlot,
	IoDeclarationPicker,
	IoDeclarationPickerOption,
	IoDeclarationText,
	IoDeclarationTextPattern,
	IoDeclarationToggle,
} from "../../io/declaration";

export const Declaration = IoDeclaration;
export type Declaration = z.infer<typeof Declaration>;
export type DeclarationType = Declaration["type"];

export type DeclarationLocalized = z.infer<typeof IoDeclarationLocalized>;

export type DeclarationText = z.infer<typeof IoDeclarationText>;
export type DeclarationTextPattern = z.infer<typeof IoDeclarationTextPattern>;

export type DeclarationToggle = z.infer<typeof IoDeclarationToggle>;

export type DeclarationPicker = z.infer<typeof IoDeclarationPicker>;
export type DeclarationPickerStatic = Extract<
	DeclarationPicker,
	{ resource: "none" }
>;
export type DeclarationPickerDynamic = Exclude<
	DeclarationPicker,
	{ resource: "none" }
>;
export type DeclarationPickerOption = z.infer<typeof IoDeclarationPickerOption>;
export const DeclarationPickerResource = IoDeclarationPickerResource;
export type DeclarationPickerResource = z.infer<
	typeof DeclarationPickerResource
>;

export type DeclarationPhotos = z.infer<typeof IoDeclarationPhotos>;
export type DeclarationPhotosSlot = z.infer<typeof IoDeclarationPhotosSlot>;
