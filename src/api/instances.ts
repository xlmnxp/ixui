import type { ApiClient } from "./client";
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
    return this.client.list<Instance>("/instances");
  }

  get(name: string): Promise<Instance> {
    return this.client.get<Instance>(`/instances/${name}`);
  }

  create(body: CreateInstanceBody): Promise<AsyncResponse | SyncResponse | null> {
    return this.client.post(`/instances`, body);
  }

  update(name: string, body: { config?: Record<string, string>; description?: string; ephemeral?: boolean }): Promise<AsyncResponse | SyncResponse | null> {
    return this.client.put(`/instances/${name}`, body);
  }

  delete(name: string): Promise<void> {
    return this.client.delete(`/instances/${name}`);
  }

  setState(
    name: string,
    action: "start" | "stop" | "restart" | "freeze" | "unfreeze",
    force = false
  ): Promise<AsyncResponse | null> {
    return this.client.put(`/instances/${name}/state`, { action, force });
  }

  state(name: string): Promise<InstanceStateInfo> {
    return this.client.get<InstanceStateInfo>(`/instances/${name}/state`);
  }

  exec(name: string, command: string[], interactive: boolean): Promise<AsyncResponse | null> {
    return this.client.post(`/instances/${name}/exec`, {
      command,
      interactive,
      environment: { TERM: "xterm" },
    });
  }

  console(name: string, width: number, height: number): Promise<AsyncResponse | null> {
    return this.client.put(`/instances/${name}/console`, { width, height, type: "console" });
  }

  listSnapshots(name: string): Promise<Instance[]> {
    return this.client.list<Instance>(`/instances/${name}/snapshots`);
  }

  createSnapshot(name: string, snapName: string, stateful = false): Promise<AsyncResponse | null> {
    return this.client.post(`/instances/${name}/snapshots`, { name: snapName, stateful });
  }

  restoreSnapshot(name: string, snapName: string): Promise<AsyncResponse | null> {
    return this.client.post(`/instances/${name}/snapshots/${snapName}`, { restore: true });
  }

  deleteSnapshot(name: string, snapName: string): Promise<void> {
    return this.client.delete(`/instances/${name}/snapshots/${snapName}`);
  }

  listLogs(name: string): Promise<string[]> {
    return this.client.get<string[]>(`/instances/${name}/logs`);
  }

  readLog(name: string, file: string): Promise<string> {
    return this.client.get<string>(`/instances/${name}/logs/${file}`);
  }
}
