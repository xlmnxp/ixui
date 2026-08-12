import { projectListParam, projectQuery, projectQueryFor, projectFor, type ApiClient } from "./client";
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
    return this.client.list<Instance>("/instances", projectListParam());
  }

  get(name: string, project?: string): Promise<Instance> {
    return this.client.get<Instance>(`/instances/${name}${project !== undefined ? `?project=${encodeURIComponent(project)}` : projectQueryFor(name)}`);
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
    return this.client.put(`/instances/${name}${projectQueryFor(name)}`, body);
  }

  delete(name: string): Promise<void> {
    return this.client.delete(`/instances/${name}${projectQueryFor(name)}`);
  }

  setState(
    name: string,
    action: "start" | "stop" | "restart" | "freeze" | "unfreeze",
    force = false
  ): Promise<AsyncResponse | null> {
    return this.client.put(`/instances/${name}/state${projectQueryFor(name)}`, { action, force });
  }

  state(name: string): Promise<InstanceStateInfo> {
    return this.client.get<InstanceStateInfo>(`/instances/${name}/state${projectQueryFor(name)}`);
  }

  exec(name: string, command: string[], interactive: boolean): Promise<AsyncResponse | null> {
    return this.client.post(`/instances/${name}/exec${projectQueryFor(name)}`, {
      command,
      interactive,
      environment: { TERM: "xterm" },
      "wait-for-websocket": true,
    });
  }

  console(name: string, width: number, height: number): Promise<AsyncResponse | null> {
    return this.client.post(`/instances/${name}/console${projectQueryFor(name)}`, { width, height, type: "vga", force: true });
  }

  listSnapshots(name: string): Promise<Instance[]> {
    return this.client.list<Instance>(`/instances/${name}/snapshots`, { project: projectFor(name) });
  }

  createSnapshot(name: string, snapName: string, stateful = false): Promise<AsyncResponse | null> {
    return this.client.post(`/instances/${name}/snapshots${projectQueryFor(name)}`, { name: snapName, stateful });
  }

  restoreSnapshot(name: string, snapName: string): Promise<AsyncResponse | null> {
    return this.client.post(`/instances/${name}/snapshots/${snapName}${projectQueryFor(name)}`, { restore: true });
  }

  deleteSnapshot(name: string, snapName: string): Promise<void> {
    return this.client.delete(`/instances/${name}/snapshots/${snapName}${projectQueryFor(name)}`);
  }

  listLogs(name: string): Promise<string[]> {
    return this.client.get<string[]>(`/instances/${name}/logs${projectQueryFor(name)}`);
  }

  readLog(name: string, file: string): Promise<string> {
    return this.client.get<string>(`/instances/${name}/logs/${file}${projectQueryFor(name)}`);
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
    return this.client.post(`/instances/${name}${projectQueryFor(name)}`, { name: newName });
  }

  move(name: string, body: { live?: boolean; pool?: string; project?: string; target?: string }): Promise<AsyncResponse | SyncResponse | null> {
    const { target, project, ...rest } = body;
    const projectQueryString = project ? `?project=${encodeURIComponent(project)}` : projectQueryFor(name);
    const targetQuery = target ? `&target=${encodeURIComponent(target)}` : "";
    return this.client.post(`/instances/${name}${projectQueryString}${targetQuery}`, { migration: true, ...rest });
  }

  rebuild(name: string, body: { source: InstanceImageSource }): Promise<AsyncResponse | SyncResponse | null> {
    return this.client.post(`/instances/${name}/rebuild${projectQueryFor(name)}`, body);
  }

  freeze(name: string): Promise<AsyncResponse | null> {
    return this.setState(name, "freeze");
  }

  unfreeze(name: string): Promise<AsyncResponse | null> {
    return this.setState(name, "unfreeze");
  }

  listBackups(name: string): Promise<InstanceBackup[]> {
    return this.client.list<InstanceBackup>(`/instances/${name}/backups`, { project: projectFor(name) });
  }

  createBackup(name: string, backupName: string): Promise<AsyncResponse | null> {
    return this.client.post(`/instances/${name}/backups${projectQueryFor(name)}`, { name: backupName });
  }

  deleteBackup(name: string, backupName: string): Promise<void> {
    return this.client.delete(`/instances/${name}/backups/${backupName}${projectQueryFor(name)}`);
  }
}
