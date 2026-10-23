import type { DeclarationLocalized } from "../types/declaration";

/** english only until it's decided how declaration translations tie into paraglide */
export const localized = (value: DeclarationLocalized): string => value.en;
