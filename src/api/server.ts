import type { ApiClient } from "./client";
import type { ServerInfo } from "./types";

export class ServerApi {
  constructor(private client: ApiClient) {}

  info(): Promise<ServerInfo> {
    return this.client.get<ServerInfo>("");
  }

  metadata(): Promise<{ configs: { key: string; description: string }[] }> {
    return this.client.get<{ configs: { key: string; description: string }[] }>("/metadata");
  }

  updateConfig(config: Record<string, string>): Promise<void> {
    return this.client.put("", { config });
  }
}
