import { currentProject, projectQuery, type ApiClient } from "./client";
import type { Image, ImageAlias, Profile, Network, StoragePool, StorageVolume, Project, AsyncResponse, SyncResponse } from "./types";

export type OpResponse = AsyncResponse | SyncResponse | null;

export class InfraApi {
  constructor(private client: ApiClient) {}

  listImages(): Promise<Image[]> {
    return this.client.list<Image>("/images", { project: currentProject() });
  }

  deleteImage(fingerprint: string): Promise<void> {
    return this.client.delete(`/images/${fingerprint}${projectQuery()}`);
  }

  pullImage(source: { alias: string; server: string; protocol?: string; filename?: string }): Promise<OpResponse> {
    return this.client.post(`/images${projectQuery()}`, {
      filename: source.filename ?? source.alias,
      public: false,
      source: { type: "image", alias: source.alias, server: source.server, protocol: source.protocol ?? "simplestreams" },
    });
  }

  listAliases(): Promise<ImageAlias[]> {
    return this.client.get<ImageAlias[]>(`/images/aliases?recursion=1`);
  }

  createAlias(body: { name: string; target: string; description?: string }): Promise<OpResponse> {
    return this.client.post(`/images/aliases`, body);
  }

  deleteAlias(name: string): Promise<void> {
    return this.client.delete(`/images/aliases/${encodeURIComponent(name)}`);
  }

  listProfiles(): Promise<Profile[]> {
    return this.client.list<Profile>("/profiles", { project: currentProject() });
  }

  getProfile(name: string): Promise<Profile> {
    return this.client.get<Profile>(`/profiles/${name}${projectQuery()}`);
  }

  createProfile(body: { name: string; description?: string; config?: Record<string, string> }): Promise<OpResponse> {
    return this.client.post(`/profiles${projectQuery()}`, body);
  }

  updateProfile(name: string, body: { description?: string; config?: Record<string, string> }): Promise<OpResponse> {
    return this.client.put(`/profiles/${name}${projectQuery()}`, body);
  }

  deleteProfile(name: string): Promise<void> {
    return this.client.delete(`/profiles/${name}${projectQuery()}`);
  }

  listNetworks(): Promise<Network[]> {
    return this.client.list<Network>("/networks", { project: currentProject() });
  }

  getNetwork(name: string): Promise<Network> {
    return this.client.get<Network>(`/networks/${name}${projectQuery()}`);
  }

  createNetwork(body: { name: string; type: string; description?: string }): Promise<OpResponse> {
    return this.client.post(`/networks${projectQuery()}`, body);
  }

  updateNetwork(name: string, body: { description?: string }): Promise<OpResponse> {
    return this.client.put(`/networks/${name}${projectQuery()}`, body);
  }

  deleteNetwork(name: string): Promise<void> {
    return this.client.delete(`/networks/${name}${projectQuery()}`);
  }

  listPools(): Promise<StoragePool[]> {
    return this.client.list<StoragePool>("/storage-pools", { project: currentProject() });
  }

  createPool(body: { name: string; driver: string; description?: string }): Promise<OpResponse> {
    return this.client.post(`/storage-pools${projectQuery()}`, body);
  }

  deletePool(name: string): Promise<void> {
    return this.client.delete(`/storage-pools/${name}${projectQuery()}`);
  }

  listPoolVolumes(pool: string): Promise<StorageVolume[]> {
    return this.client.list<StorageVolume>(`/storage-pools/${pool}/volumes`, { project: currentProject() });
  }

  deletePoolVolume(pool: string, name: string): Promise<void> {
    return this.client.delete(`/storage-pools/${pool}/volumes/${name}${projectQuery()}`);
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

  updateProject(name: string, body: { description?: string; config?: Record<string, string> }): Promise<OpResponse> {
    return this.client.put(`/projects/${name}`, body);
  }

  updateNetworkConfig(name: string, body: { description?: string; config?: Record<string, string> }): Promise<OpResponse> {
    return this.client.put(`/networks/${name}${projectQuery()}`, body);
  }

  updatePoolConfig(name: string, body: { config?: Record<string, string> }): Promise<OpResponse> {
    return this.client.put(`/storage-pools/${name}${projectQuery()}`, body);
  }
}
