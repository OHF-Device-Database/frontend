import { Device } from "./device";
import { MOCK_DEVICES } from "./mock-devices";

export async function fetchDevices(): Promise<Device[]> {
    return MOCK_DEVICES.map((device) => Device.parse(device));
}

export async function fetchDevice(id: string): Promise<Device | undefined> {
    const device = MOCK_DEVICES.find((candidate) => candidate.id === id);
    return typeof device === "undefined" ? undefined : Device.parse(device);
}
