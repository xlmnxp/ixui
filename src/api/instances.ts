import { currentProject, projectQuery, type ApiClient } from "./client";
import type { Instance, InstanceStateInfo, InstanceBackup, AsyncResponse, SyncResponse } from "./types";

export interface InstanceImageSource {
  type: "image";
  image?: string;
  fingerprint?: string;
  server?: string;
  alias?: string;
  protocol?: string;
}

export interface CreateInstanceBody {
  name: string;
  type: "container" | "virtual-machine";
  description?: string;
  profiles?: string[];
  source?: InstanceImageSource;
  config?: Record<string, string>;
  devices?: Record<string, Record<string, string>>;
  ephemeral?: boolean;
}

export class InstancesApi {
  constructor(private client: ApiClient) {}

  list(): Promise<Instance[]> {
    return this.client.list<Instance>("/instances", { project: currentProject() });
  }

  get(name: string): Promise<Instance> {
    return this.client.get<Instance>(`/instances/${name}${projectQuery()}`);
  }

  create(body: CreateInstanceBody, target?: string): Promise<AsyncResponse | SyncResponse | null> {
    const targetQuery = target ? `&target=${encodeURIComponent(target)}` : "";
    return this.client.post(`/instances${projectQuery()}${targetQuery}`, body);
  }

  update(
    name: string,
    body: {
      config?: Record<string, string>;
      description?: string;
      ephemeral?: boolean;
      devices?: Record<string, Record<string, string>>;
    }
  ): Promise<AsyncResponse | SyncResponse | null> {
    return this.client.put(`/instances/${name}${projectQuery()}`, body);
  }

  delete(name: string): Promise<void> {
    return this.client.delete(`/instances/${name}${projectQuery()}`);
  }

  setState(
    name: string,
    action: "start" | "stop" | "restart" | "freeze" | "unfreeze",
    force = false
  ): Promise<AsyncResponse | null> {
    return this.client.put(`/instances/${name}/state${projectQuery()}`, { action, force });
  }

  state(name: string): Promise<InstanceStateInfo> {
    return this.client.get<InstanceStateInfo>(`/instances/${name}/state${projectQuery()}`);
  }

  exec(name: string, command: string[], interactive: boolean): Promise<AsyncResponse | null> {
    return this.client.post(`/instances/${name}/exec${projectQuery()}`, {
      command,
      interactive,
      environment: { TERM: "xterm" },
      "wait-for-websocket": true,
    });
  }

  console(name: string, width: number, height: number): Promise<AsyncResponse | null> {
    return this.client.post(`/instances/${name}/console${projectQuery()}`, { width, height, type: "vga", force: true });
  }

  listSnapshots(name: string): Promise<Instance[]> {
    return this.client.list<Instance>(`/instances/${name}/snapshots`, { project: currentProject() });
  }

  createSnapshot(name: string, snapName: string, stateful = false): Promise<AsyncResponse | null> {
    return this.client.post(`/instances/${name}/snapshots${projectQuery()}`, { name: snapName, stateful });
  }

  restoreSnapshot(name: string, snapName: string): Promise<AsyncResponse | null> {
    return this.client.post(`/instances/${name}/snapshots/${snapName}${projectQuery()}`, { restore: true });
  }

  deleteSnapshot(name: string, snapName: string): Promise<void> {
    return this.client.delete(`/instances/${name}/snapshots/${snapName}${projectQuery()}`);
  }

  listLogs(name: string): Promise<string[]> {
    return this.client.get<string[]>(`/instances/${name}/logs${projectQuery()}`);
  }

  readLog(name: string, file: string): Promise<string> {
    return this.client.get<string>(`/instances/${name}/logs/${file}${projectQuery()}`);
  }

  copy(
    name: string,
    target: string,
    options?: { live?: boolean; pool?: string; project?: string }
  ): Promise<AsyncResponse | SyncResponse | null> {
    const source: { type: "copy"; source: string; project?: string } = { type: "copy", source: name };
    if (options?.project !== undefined) source.project = options.project;
    const body: { source: typeof source; name: string; live?: boolean; pool?: string } = {
      source,
      name: target,
    };
    if (options?.live !== undefined) body.live = options.live;
    if (options?.pool !== undefined) body.pool = options.pool;
    return this.client.post(`/instances${projectQuery()}`, body);
  }

  rename(name: string, newName: string): Promise<AsyncResponse | SyncResponse | null> {
    return this.client.post(`/instances/${name}${projectQuery()}`, { name: newName });
  }

  move(name: string, body: { live?: boolean; pool?: string; project?: string; target?: string }): Promise<AsyncResponse | SyncResponse | null> {
    const { target, project, ...rest } = body;
    const projectQueryString = project ? `?project=${encodeURIComponent(project)}` : projectQuery();
    const targetQuery = target ? `&target=${encodeURIComponent(target)}` : "";
    return this.client.post(`/instances/${name}${projectQueryString}${targetQuery}`, { migration: true, ...rest });
  }

  rebuild(name: string, body: { source: InstanceImageSource }): Promise<AsyncResponse | SyncResponse | null> {
    return this.client.post(`/instances/${name}/rebuild${projectQuery()}`, body);
  }

  freeze(name: string): Promise<AsyncResponse | null> {
    return this.setState(name, "freeze");
  }

  unfreeze(name: string): Promise<AsyncResponse | null> {
    return this.setState(name, "unfreeze");
  }

  listBackups(name: string): Promise<InstanceBackup[]> {
    return this.client.list<InstanceBackup>(`/instances/${name}/backups`, { project: currentProject() });
  }

  createBackup(name: string, backupName: string): Promise<AsyncResponse | null> {
    return this.client.post(`/instances/${name}/backups${projectQuery()}`, { name: backupName });
  }

  deleteBackup(name: string, backupName: string): Promise<void> {
    return this.client.delete(`/instances/${name}/backups/${backupName}${projectQuery()}`);
  }
}
