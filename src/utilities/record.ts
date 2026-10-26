/** `Object.keys` that keeps the key type of a closed record */
export const keysOf = <K extends string>(record: Record<K, unknown>): K[] =>
	Object.keys(record) as K[];

/** `Object.fromEntries` that keeps the key type */
export const recordOf = <K extends string, V>(
	keys: readonly K[],
	value: (key: K) => V,
): Record<K, V> =>
	Object.fromEntries(keys.map((key) => [key, value(key)])) as Record<K, V>;
