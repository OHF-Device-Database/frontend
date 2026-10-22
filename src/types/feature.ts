export type FeatureDefinition = {
	label: string;
	description: string;
};

export const FEATURES = {
	foo: {
		label: "foo feature",
		description: "enables foo",
	},
} as const satisfies Record<string, FeatureDefinition>;

export type FeatureName = keyof typeof FEATURES;
export type FeatureState = Record<FeatureName, boolean>;

export const FEATURE_NAMES = Object.keys(FEATURES) as readonly FeatureName[];

export const isFeatureName = (value: unknown): value is FeatureName =>
	(FEATURE_NAMES as readonly unknown[]).includes(value);
