import type { ApiClient } from "./client";
import type { ServerInfo } from "./types";

export class ServerApi {
  constructor(private client: ApiClient) {}

  info(): Promise<ServerInfo> {
    return this.client.get<ServerInfo>("/");
  }
}
