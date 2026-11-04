import { createStore } from "./store";
import type { ServerInfo } from "../api/types";

/** Architectures the connected server can run, from GET /1.0 environment.architectures. */
export const serverArchitecturesStore = createStore<string[]>([]);

/** Storage driver names the server supports, from environment.storage_supported_drivers. */
export const serverDriversStore = createStore<string[]>([]);

/** Record the parts of the server environment the UI uses for suggestions. */
export function setServerEnvironment(info: ServerInfo): void {
  const arch = info.environment?.architectures;
  if (Array.isArray(arch) && arch.length > 0) {
    serverArchitecturesStore.setState(arch);
  }
  const drivers = info.environment?.storage_supported_drivers;
  if (Array.isArray(drivers) && drivers.length > 0) {
    serverDriversStore.setState(drivers.map((d) => d.name).filter(Boolean));
  }
}
