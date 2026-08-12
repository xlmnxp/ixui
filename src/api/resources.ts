import type { ApiClient } from "./client";

export interface HostResources {
  cpu: { total: number; sockets?: unknown[] };
  memory: { total: number; used: number };
  disk?: unknown;
  gpu?: unknown;
}

export class ResourcesApi {
  constructor(private client: ApiClient) {}

  get(project?: string): Promise<HostResources> {
    const qs = project !== undefined ? `?project=${encodeURIComponent(project)}&recursion=1` : "?recursion=1";
    return this.client.get<HostResources>(`/resources${qs}`);
  }

  getMemberResources(member: string): Promise<HostResources> {
    return this.client.get<HostResources>(`/cluster/members/${member}/resources?recursion=1`);
  }
}
