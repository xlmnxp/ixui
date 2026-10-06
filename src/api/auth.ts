import type { ApiClient } from "./client";
import type { AsyncResponse, SyncResponse } from "./types";

export type OpResponse = AsyncResponse | SyncResponse | null;

export interface Identity {
  authentication_method: string;
  type: string;
  identifier: string;
  name: string;
  groups: string[] | null;
  tls_certificate?: string;
}

export interface Permission {
  entity_type: string;
  url: string;
  entitlement: string;
}

export interface AuthGroup {
  name: string;
  description: string;
  permissions: Permission[] | null;
  identities?: Record<string, string[]> | null;
  identity_provider_groups?: string[] | null;
}

const seg = encodeURIComponent;

export class AuthApi {
  constructor(private client: ApiClient) {}

  listIdentities(): Promise<Identity[]> {
    return this.client.get<Identity[]>("/auth/identities?recursion=1");
  }

  /** PUT replaces the identity's group membership. */
  updateIdentityGroups(identity: Pick<Identity, "authentication_method" | "identifier" | "tls_certificate">, groups: string[]): Promise<OpResponse> {
    const body: { groups: string[]; tls_certificate?: string } = { groups };
    if (identity.tls_certificate) body.tls_certificate = identity.tls_certificate;
    return this.client.put(`/auth/identities/${seg(identity.authentication_method)}/${seg(identity.identifier)}`, body);
  }

  deleteIdentity(identity: Pick<Identity, "authentication_method" | "identifier">): Promise<void> {
    return this.client.delete(`/auth/identities/${seg(identity.authentication_method)}/${seg(identity.identifier)}`);
  }

  listGroups(): Promise<AuthGroup[]> {
    return this.client.get<AuthGroup[]>("/auth/groups?recursion=1");
  }

  createGroup(name: string, description: string): Promise<OpResponse> {
    return this.client.post("/auth/groups", { name, description });
  }

  /** PUT replaces description and permissions, so callers send both. */
  updateGroup(name: string, body: { description: string; permissions: Permission[] }): Promise<OpResponse> {
    return this.client.put(`/auth/groups/${seg(name)}`, body);
  }

  deleteGroup(name: string): Promise<void> {
    return this.client.delete(`/auth/groups/${seg(name)}`);
  }
}
