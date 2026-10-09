import type { z } from "astro/zod";

import {
	IoDeviceCategoryId,
	IoDeviceConnectivityId,
	IoDeviceIntegration,
	IoDeviceVersionHardware,
} from "../../io/device";
import type { IoDeviceMono, IoDevicePoly } from "../../io/device";
import type { Unknown } from "../unknown";

export const DeviceConnectivityId = IoDeviceConnectivityId;
export type DeviceConnectivityId = z.infer<typeof DeviceConnectivityId>;

export const DeviceCategoryId = IoDeviceCategoryId;
export type DeviceCategoryId = z.infer<typeof DeviceCategoryId>;

export const DeviceIntegration = IoDeviceIntegration;
export type DeviceIntegration = z.infer<typeof DeviceIntegration>;

export const DeviceVersionHardware = IoDeviceVersionHardware;
export type DeviceVersionHardware = z.infer<typeof DeviceVersionHardware>;

export type DeviceVersionSoftware = {
	version: string;
	active: number;
	firstEncountered: Date;
};

export type DeviceEntity = {
	domain: string;
	originalDeviceClass?: string | undefined;
};

export type DeviceMono = {
	manufacturer: string;
	categories?: (DeviceCategoryId | Unknown)[] | undefined;
	connectivity: DeviceConnectivityId | Unknown;
	count: number;
	integration: DeviceIntegration;
	entities: DeviceEntity[];
	versions: {
		software: DeviceVersionSoftware[];
		hardware: DeviceVersionHardware[];
	};
	firstEncountered: Date;
} & (
	| { model: string; modelId: string }
	| { model: undefined; modelId: string }
	| { model: string; modelId: undefined }
);

export type DevicePoly = DeviceMono & {
	id: string;
};

export const deviceMonoMap = (repr: IoDeviceMono): DeviceMono => {
	const base: Omit<DeviceMono, "model" | "modelId"> = {
		manufacturer: repr.manufacturer,
		categories: repr.categories?.map((category) => category.id),
		connectivity: repr.connectivity,
		count: repr.count,
		integration: repr.integration,
		entities: repr.entities.map((entity) => ({
			domain: entity.domain,
			originalDeviceClass: entity.original_device_class,
		})),
		versions: {
			software: repr.versions.software.map((v) => ({
				version: v.version,
				active: v.active,
				firstEncountered: v.first_encountered,
			})),
			hardware: repr.versions.hardware,
		},
		firstEncountered: repr.first_encountered,
	};

	if (
		typeof repr.model !== "undefined" &&
		typeof repr.model_id !== "undefined"
	) {
		return {
			...base,
			model: repr.model,
			modelId: repr.model_id,
		};
	} else if (
		typeof repr.model !== "undefined" &&
		typeof repr.model_id === "undefined"
	) {
		return { ...base, model: repr.model, modelId: repr.model_id };
	} else if (
		typeof repr.model === "undefined" &&
		typeof repr.model_id !== "undefined"
	) {
		return { ...base, model: repr.model, modelId: repr.model_id };
	}

	throw new Error("unreachable");
};
export const devicePolyMap = (repr: IoDevicePoly): DevicePoly =>
	Object.assign(deviceMonoMap(repr), { id: repr.id });
