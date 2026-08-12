import { currentProject, projectQuery, type ApiClient } from "./client";
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

  list(instance: string): Promise<Backup[]> {
    return this.client.list<Backup>(`/instances/${instance}/backups`, { project: currentProject() });
  }

  create(instance: string, name: string, options?: CreateBackupOptions): Promise<AsyncResponse | SyncResponse | null> {
    return this.client.post(`/instances/${instance}/backups${projectQuery()}`, { name, ...options });
  }

  delete(instance: string, name: string): Promise<void> {
    return this.client.delete(`/instances/${instance}/backups/${name}${projectQuery()}`);
  }

  exportUrl(instance: string, name: string): string {
    return `/1.0/instances/${instance}/backups/${name}/export${projectQuery()}`;
  }
}
