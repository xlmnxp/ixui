import type { ApiClient } from "./client";
import type { AsyncResponse, SyncResponse } from "./types";

export interface AuthIdentity {
  type: string;
  id: string;
  name: string;
  groups: string[];
  access_entitlements: string[];
}

export interface AuthGroup {
  name: string;
  description: string;
  permissions: string[];
}

export interface AuthPermission {
  entitlement: string;
  description?: string;
}

export class AuthApi {
  constructor(private client: ApiClient) {}

  listIdentities(): Promise<AuthIdentity[]> {
    return this.client.list<AuthIdentity>("/auth/identities");
  }

  listGroups(): Promise<AuthGroup[]> {
    return this.client.list<AuthGroup>("/auth/groups");
  }

  getGroup(name: string): Promise<AuthGroup> {
    return this.client.get<AuthGroup>(`/auth/groups/${encodeURIComponent(name)}`);
  }

  createGroup(body: { name: string; description?: string; permissions?: string[] }): Promise<AsyncResponse | SyncResponse | null> {
    return this.client.post("/auth/groups", body);
  }

  updateGroup(name: string, body: { description?: string; permissions?: string[] }): Promise<AsyncResponse | SyncResponse | null> {
    return this.client.put(`/auth/groups/${encodeURIComponent(name)}`, body);
  }

  deleteGroup(name: string): Promise<void> {
    return this.client.delete(`/auth/groups/${encodeURIComponent(name)}`);
  }

  updateIdentity(type: string, id: string, body: { groups: string[] }): Promise<AsyncResponse | SyncResponse | null> {
    return this.client.put(`/auth/identities/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, body);
  }

  listPermissions(): Promise<AuthPermission[]> {
    return this.client.get<AuthPermission[]>("/auth/permissions?recursion=1");
  }
}
