import { projectFor, projectQueryFor, type ApiClient } from "./client";
import type { AsyncResponse, SyncResponse } from "./types";

export interface Backup {
  name: string;
  created_at: string;
  optimized_storage: boolean;
  compression: string;
}

export interface CreateBackupOptions {
  compression_algorithm?: string;
  optimized_storage?: boolean;
}

export class BackupsApi {
  constructor(private client: ApiClient) {}

  list(instance: string, project?: string): Promise<Backup[]> {
    return this.client.list<Backup>(`/instances/${instance}/backups`, { project: project ?? projectFor(instance) });
  }

  create(instance: string, name: string, options?: CreateBackupOptions, project?: string): Promise<AsyncResponse | SyncResponse | null> {
    return this.client.post(`/instances/${instance}/backups${projectQueryFor(instance, project)}`, { name, ...options });
  }

  delete(instance: string, name: string, project?: string): Promise<void> {
    return this.client.delete(`/instances/${instance}/backups/${name}${projectQueryFor(instance, project)}`);
  }

  exportUrl(instance: string, name: string, project?: string): string {
    return `/1.0/instances/${instance}/backups/${name}/export${projectQueryFor(instance, project)}`;
  }
}
