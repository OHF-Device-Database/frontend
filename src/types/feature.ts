import { keysOf } from "../utilities/record";

export type FeatureDefinition = {
	label: string;
	description: string;
};

export const FEATURES = {} as const satisfies Record<string, FeatureDefinition>;

export type FeatureName = keyof typeof FEATURES;
export type FeatureState = Record<FeatureName, boolean>;

export const isFeatureName = (value: unknown): value is FeatureName =>
	typeof value === "string" && Object.hasOwn(FEATURES, value);

export const FEATURE_NAMES: readonly FeatureName[] = keysOf(FEATURES);
