import { currentProject, projectQuery, type ApiClient } from "./client";
import type { StorageVolume, StorageVolumeDetail, AsyncResponse, SyncResponse } from "./types";

export type OpResponse = AsyncResponse | SyncResponse | null;

export interface CreateVolumeBody {
  name: string;
  type: "custom" | "iso" | "image";
  content_type?: string;
  config?: Record<string, string>;
}

export class VolumesApi {
  constructor(private client: ApiClient) {}

  list(pool: string): Promise<StorageVolume[]> {
    return this.client.list<StorageVolume>(`/storage-pools/${pool}/volumes`, { project: currentProject() });
  }

  get(pool: string, type: string, name: string): Promise<StorageVolumeDetail> {
    return this.client.get<StorageVolumeDetail>(`/storage-pools/${pool}/volumes/${type}/${name}${projectQuery()}`);
  }

  create(pool: string, body: CreateVolumeBody): Promise<OpResponse> {
    return this.client.post(`/storage-pools/${pool}/volumes${projectQuery()}`, body);
  }

  update(pool: string, type: string, name: string, body: unknown): Promise<OpResponse> {
    return this.client.put(`/storage-pools/${pool}/volumes/${type}/${name}${projectQuery()}`, body);
  }

  delete(pool: string, type: string, name: string): Promise<void> {
    return this.client.delete(`/storage-pools/${pool}/volumes/${type}/${name}${projectQuery()}`);
  }

  resize(pool: string, type: string, name: string, size: string): Promise<OpResponse> {
    return this.client.put(`/storage-pools/${pool}/volumes/${type}/${name}${projectQuery()}`, { size });
  }

  rename(pool: string, type: string, name: string, newName: string): Promise<OpResponse> {
    return this.client.post(`/storage-pools/${pool}/volumes/${type}/${name}${projectQuery()}`, { name: newName });
  }

  listSnapshots(pool: string, type: string, name: string): Promise<StorageVolumeDetail[]> {
    return this.client.list<StorageVolumeDetail>(`/storage-pools/${pool}/volumes/${type}/${name}/snapshots`, {
      project: currentProject(),
    });
  }

  createSnapshot(pool: string, type: string, name: string, snapName: string): Promise<OpResponse> {
    return this.client.post(`/storage-pools/${pool}/volumes/${type}/${name}/snapshots${projectQuery()}`, {
      name: snapName,
    });
  }

  deleteSnapshot(pool: string, type: string, name: string, snap: string): Promise<void> {
    return this.client.delete(`/storage-pools/${pool}/volumes/${type}/${name}/snapshots/${snap}${projectQuery()}`);
  }

  restoreSnapshot(pool: string, type: string, name: string, snap: string): Promise<OpResponse> {
    return this.client.put(`/storage-pools/${pool}/volumes/${type}/${name}${projectQuery()}`, {
      restore: snap,
    });
  }

  uploadIso(pool: string, name: string, file: Blob): Promise<OpResponse> {
    return this.client.postRaw(
      `/storage-pools/${pool}/volumes${projectQuery()}`,
      file,
      { "Content-Type": "application/octet-stream", "X-Incus-type": "iso", "X-Incus-name": name }
    );
  }

  listBuckets(pool: string): Promise<StorageVolumeDetail[]> {
    return this.client.list<StorageVolumeDetail>(`/storage-pools/${pool}/buckets`, { project: currentProject() });
  }

  createBucket(pool: string, body: unknown): Promise<OpResponse> {
    return this.client.post(`/storage-pools/${pool}/buckets${projectQuery()}`, body);
  }

  deleteBucket(pool: string, name: string): Promise<void> {
    return this.client.delete(`/storage-pools/${pool}/buckets/${name}${projectQuery()}`);
  }
}
