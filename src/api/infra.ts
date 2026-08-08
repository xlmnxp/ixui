import type { ApiClient } from "./client";
import type { Image, Profile, Network, StoragePool, StorageVolume, Project, AsyncResponse, SyncResponse } from "./types";

export type OpResponse = AsyncResponse | SyncResponse | null;

export class InfraApi {
  constructor(private client: ApiClient) {}

  listImages(): Promise<Image[]> {
    return this.client.list<Image>("/images");
  }

  deleteImage(fingerprint: string): Promise<void> {
    return this.client.delete(`/images/${fingerprint}`);
  }

  pullImage(source: { alias: string; server: string; protocol?: string; filename?: string }): Promise<OpResponse> {
    return this.client.post(`/images`, {
      filename: source.filename ?? source.alias,
      public: false,
      source: { type: "image", alias: source.alias, server: source.server, protocol: source.protocol ?? "simplestreams" },
    });
  }

  listProfiles(): Promise<Profile[]> {
    return this.client.list<Profile>("/profiles");
  }

  getProfile(name: string): Promise<Profile> {
    return this.client.get<Profile>(`/profiles/${name}`);
  }

  createProfile(body: { name: string; description?: string; config?: Record<string, string> }): Promise<OpResponse> {
    return this.client.post(`/profiles`, body);
  }

  updateProfile(name: string, body: { description?: string; config?: Record<string, string> }): Promise<OpResponse> {
    return this.client.put(`/profiles/${name}`, body);
  }

  deleteProfile(name: string): Promise<void> {
    return this.client.delete(`/profiles/${name}`);
  }

  listNetworks(): Promise<Network[]> {
    return this.client.list<Network>("/networks");
  }

  createNetwork(body: { name: string; type: string; description?: string }): Promise<OpResponse> {
    return this.client.post(`/networks`, body);
  }

  updateNetwork(name: string, body: { description?: string }): Promise<OpResponse> {
    return this.client.put(`/networks/${name}`, body);
  }

  deleteNetwork(name: string): Promise<void> {
    return this.client.delete(`/networks/${name}`);
  }

  listPools(): Promise<StoragePool[]> {
    return this.client.list<StoragePool>("/storage-pools");
  }

  createPool(body: { name: string; driver: string; description?: string }): Promise<OpResponse> {
    return this.client.post(`/storage-pools`, body);
  }

  deletePool(name: string): Promise<void> {
    return this.client.delete(`/storage-pools/${name}`);
  }

  listPoolVolumes(pool: string): Promise<StorageVolume[]> {
    return this.client.list<StorageVolume>(`/storage-pools/${pool}/volumes`);
  }

  deletePoolVolume(pool: string, name: string): Promise<void> {
    return this.client.delete(`/storage-pools/${pool}/volumes/${name}`);
  }

  listProjects(): Promise<Project[]> {
    return this.client.list<Project>("/projects");
  }

  getProject(name: string): Promise<Project> {
    return this.client.get<Project>(`/projects/${name}`);
  }

  createProject(body: { name: string; description?: string }): Promise<OpResponse> {
    return this.client.post(`/projects`, body);
  }

  deleteProject(name: string): Promise<void> {
    return this.client.delete(`/projects/${name}`);
  }
}
