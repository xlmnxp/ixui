import { currentProject, projectQuery, type ApiClient } from "./client";
import type { AsyncResponse, SyncResponse } from "./types";

export interface Acl {
  name: string;
  description: string;
  egress: unknown[];
  ingress: unknown[];
  used_by: string[];
}

export interface Forward {
  listen_address: string;
  description: string;
}

export interface Lease {
  address: string;
  hostname: string;
  hwaddr: string;
  type: string;
  expires_at: string;
}

export interface Zone {
  name: string;
  description: string;
  used_by: string[];
}

export interface AddressSet {
  name: string;
  description: string;
  addresses: string[];
  used_by: string[];
}

export type OpResponse = AsyncResponse | SyncResponse | null;

export class NetworkExtrasApi {
  constructor(private client: ApiClient) {}

  listAcls(): Promise<Acl[]> {
    return this.client.list<Acl>("/network-acls", { project: currentProject() });
  }

  getAcl(name: string): Promise<Acl> {
    return this.client.get<Acl>(`/network-acls/${name}${projectQuery()}`);
  }

  createAcl(body: { name: string; description?: string }): Promise<OpResponse> {
    return this.client.post(`/network-acls${projectQuery()}`, body);
  }

  deleteAcl(name: string): Promise<void> {
    return this.client.delete(`/network-acls/${name}${projectQuery()}`);
  }

  updateAcl(name: string, body: unknown): Promise<OpResponse> {
    return this.client.patch(`/network-acls/${name}${projectQuery()}`, body);
  }

  listForwards(network: string): Promise<Forward[]> {
    return this.client.list<Forward>(`/networks/${network}/forwards`, { project: currentProject() });
  }

  createForward(network: string, body: unknown): Promise<OpResponse> {
    return this.client.post(`/networks/${network}/forwards${projectQuery()}`, body);
  }

  deleteForward(network: string, name: string): Promise<void> {
    return this.client.delete(`/networks/${network}/forwards/${name}${projectQuery()}`);
  }

  listLeases(network: string): Promise<Lease[]> {
    return this.client.list<Lease>(`/networks/${network}/leases`, { project: currentProject() });
  }

  listZones(): Promise<Zone[]> {
    return this.client.list<Zone>("/network-zones", { project: currentProject() });
  }

  createZone(body: unknown): Promise<OpResponse> {
    return this.client.post(`/network-zones${projectQuery()}`, body);
  }

  deleteZone(name: string): Promise<void> {
    return this.client.delete(`/network-zones/${name}${projectQuery()}`);
  }

  listAddressSets(): Promise<AddressSet[]> {
    return this.client.list<AddressSet>("/network-address-sets", { project: currentProject() });
  }

  createAddressSet(body: { name: string; addresses?: string[] }): Promise<OpResponse> {
    return this.client.post(`/network-address-sets${projectQuery()}`, body);
  }

  deleteAddressSet(name: string): Promise<void> {
    return this.client.delete(`/network-address-sets/${name}${projectQuery()}`);
  }
}
