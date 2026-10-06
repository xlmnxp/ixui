import { projectListParam, projectQuery, type ApiClient } from "./client";
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

export interface LoadBalancerBackend {
  name: string;
  description?: string;
  target_address: string;
  target_port?: string;
}

export interface LoadBalancerPort {
  description?: string;
  protocol: "tcp" | "udp";
  listen_port: string;
  target_backend: string[];
}

export interface LoadBalancer {
  listen_address: string;
  description: string;
  backends: LoadBalancerBackend[];
  ports: LoadBalancerPort[];
}

export interface NetworkPeer {
  name: string;
  description: string;
  target_project?: string;
  target_network?: string;
  status?: string;
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
  config?: Record<string, string>;
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
    return this.client.list<Acl>("/network-acls", projectListParam());
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
    return this.client.list<Forward>(`/networks/${network}/forwards`, projectListParam());
  }

  createForward(network: string, body: unknown): Promise<OpResponse> {
    return this.client.post(`/networks/${network}/forwards${projectQuery()}`, body);
  }

  deleteForward(network: string, name: string): Promise<void> {
    return this.client.delete(`/networks/${network}/forwards/${name}${projectQuery()}`);
  }

  listLoadBalancers(network: string): Promise<LoadBalancer[]> {
    return this.client.list<LoadBalancer>(`/networks/${network}/load-balancers`, projectListParam());
  }

  createLoadBalancer(network: string, body: LoadBalancer): Promise<OpResponse> {
    return this.client.post(`/networks/${network}/load-balancers${projectQuery()}`, body);
  }

  deleteLoadBalancer(network: string, listenAddress: string): Promise<void> {
    return this.client.delete(`/networks/${network}/load-balancers/${encodeURIComponent(listenAddress)}${projectQuery()}`);
  }

  listPeers(network: string): Promise<NetworkPeer[]> {
    return this.client.list<NetworkPeer>(`/networks/${network}/peers`, projectListParam());
  }

  createPeer(network: string, body: { name: string; description?: string; target_project: string; target_network: string }): Promise<OpResponse> {
    return this.client.post(`/networks/${network}/peers${projectQuery()}`, body);
  }

  deletePeer(network: string, name: string): Promise<void> {
    return this.client.delete(`/networks/${network}/peers/${name}${projectQuery()}`);
  }

  listLeases(network: string): Promise<Lease[]> {
    return this.client.list<Lease>(`/networks/${network}/leases`, projectListParam());
  }

  listZones(): Promise<Zone[]> {
    return this.client.list<Zone>("/network-zones", projectListParam());
  }

  updateZone(name: string, body: { description?: string; config?: Record<string, string> }): Promise<OpResponse> {
    return this.client.patch(`/network-zones/${name}${projectQuery()}`, body);
  }

  createZone(body: { name: string; description?: string; config?: Record<string, string> }): Promise<OpResponse> {
    return this.client.post(`/network-zones${projectQuery()}`, body);
  }

  deleteZone(name: string): Promise<void> {
    return this.client.delete(`/network-zones/${name}${projectQuery()}`);
  }

  listAddressSets(): Promise<AddressSet[]> {
    return this.client.list<AddressSet>("/network-address-sets", projectListParam());
  }

  createAddressSet(body: { name: string; description?: string; addresses?: string[] }): Promise<OpResponse> {
    return this.client.post(`/network-address-sets${projectQuery()}`, body);
  }

  updateAddressSet(name: string, body: { description?: string; addresses?: string[] }): Promise<OpResponse> {
    return this.client.patch(`/network-address-sets/${name}${projectQuery()}`, body);
  }

  deleteAddressSet(name: string): Promise<void> {
    return this.client.delete(`/network-address-sets/${name}${projectQuery()}`);
  }
}
