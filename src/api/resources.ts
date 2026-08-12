import type { ApiClient } from "./client";

export interface HostResources {
  cpu: { total: number; sockets?: unknown[] };
  memory: { total: number; used: number };
  disk?: unknown;
  gpu?: unknown;
}

export class ResourcesApi {
  constructor(private client: ApiClient) {}

  get(): Promise<HostResources> {
    return this.client.get<HostResources>("/resources");
  }

  getMemberResources(member: string): Promise<HostResources> {
    return this.client.get<HostResources>(`/resources?target=${encodeURIComponent(member)}`);
  }
}
