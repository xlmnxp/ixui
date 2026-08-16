import type { ApiClient } from "./client";
import type { ServerInfo } from "./types";

export class ServerApi {
  constructor(private client: ApiClient) {}

  info(): Promise<ServerInfo> {
    return this.client.get<ServerInfo>("");
  }

  /** Configuration key descriptions (nested group/entity/keys shape). */
  metadata(): Promise<{ configs?: unknown }> {
    return this.client.get<{ configs?: unknown }>("/metadata/configuration");
  }

  updateConfig(config: Record<string, string>): Promise<void> {
    return this.client.put("", { config });
  }
}
