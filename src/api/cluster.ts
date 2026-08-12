import type { ApiClient } from "./client";
import type { ClusterMember, ClusterGroup, AsyncResponse, SyncResponse } from "./types";

export type OpResponse = AsyncResponse | SyncResponse | null;

export class ClusterApi {
  constructor(private client: ApiClient) {}

  listMembers(): Promise<ClusterMember[]> {
    return this.client.get<ClusterMember[]>("/cluster/members?recursion=1");
  }

  listGroups(): Promise<ClusterGroup[]> {
    return this.client.get<ClusterGroup[]>("/cluster/groups?recursion=1");
  }

  createGroup(body: { name: string; description?: string }): Promise<OpResponse> {
    return this.client.post("/cluster/groups", body);
  }

  deleteGroup(name: string): Promise<void> {
    return this.client.delete(`/cluster/groups/${name}`);
  }

  setMemberState(member: string, action: "evacuate" | "restore"): Promise<OpResponse> {
    return this.client.post(`/cluster/members/${member}/state`, { action });
  }

  createJoinToken(name: string, groups: string[] = []): Promise<OpResponse> {
    return this.client.post("/cluster/members", { server_name: name, groups });
  }

  getMemberResources(member: string): Promise<unknown> {
    return this.client.get(`/cluster/members/${member}/resources`);
  }
}
