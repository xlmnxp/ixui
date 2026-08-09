import type { ApiClient } from "./client";
import type { ClusterMember } from "./types";

export class ClusterApi {
  constructor(private client: ApiClient) {}

  listMembers(): Promise<ClusterMember[]> {
    return this.client.get<ClusterMember[]>("/cluster/members?recursion=1");
  }
}
