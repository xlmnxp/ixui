import { currentProject, projectQuery, type ApiClient } from "./client";
import type { Instance, InstanceStateInfo, AsyncResponse, SyncResponse } from "./types";

export interface CreateInstanceBody {
  name: string;
  type: "container" | "virtual-machine";
  description?: string;
  profiles?: string[];
  source?: { type: "image"; image?: string; fingerprint?: string; server?: string; alias?: string };
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

  update(name: string, body: { config?: Record<string, string>; description?: string; ephemeral?: boolean }): Promise<AsyncResponse | SyncResponse | null> {
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
}
