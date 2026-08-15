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

  create(body: CreateInstanceBody, target?: string, project?: string): Promise<AsyncResponse | SyncResponse | null> {
    const projectQueryString = project !== undefined ? `?project=${encodeURIComponent(project)}` : projectQuery();
    const targetQuery = target ? `&target=${encodeURIComponent(target)}` : "";
    return this.client.post(`/instances${projectQueryString}${targetQuery}`, body);
  }

  update(
    name: string,
    body: {
      config?: Record<string, string>;
      description?: string;
      ephemeral?: boolean;
      devices?: Record<string, Record<string, string>>;
    },
    project?: string
  ): Promise<AsyncResponse | SyncResponse | null> {
    return this.client.put(`/instances/${name}${projectQueryFor(name, project)}`, body);
  }

  delete(name: string, project?: string): Promise<void> {
    return this.client.delete(`/instances/${name}${projectQueryFor(name, project)}`);
  }

  setState(
    name: string,
    action: "start" | "stop" | "restart" | "freeze" | "unfreeze",
    force = false,
    project?: string
  ): Promise<AsyncResponse | null> {
    return this.client.put(`/instances/${name}/state${projectQueryFor(name, project)}`, { action, force });
  }

  state(name: string, project?: string): Promise<InstanceStateInfo> {
    return this.client.get<InstanceStateInfo>(`/instances/${name}/state${projectQueryFor(name, project)}`);
  }

  exec(name: string, command: string[], interactive: boolean, project?: string): Promise<AsyncResponse | null> {
    return this.client.post(`/instances/${name}/exec${projectQueryFor(name, project)}`, {
      command,
      interactive,
      environment: { TERM: "xterm" },
      "wait-for-websocket": true,
    });
  }

  console(name: string, width: number, height: number, project?: string): Promise<AsyncResponse | null> {
    return this.client.post(`/instances/${name}/console${projectQueryFor(name, project)}`, { width, height, type: "vga", force: true });
  }

  /** URL of the VM display screenshot (GET console with type=vga returns image/png). */
  screenshotUrl(name: string, project?: string): string {
    const query = projectQueryFor(name, project);
    const separator = query === "" ? "?" : `${query}&`;
    return `/1.0/instances/${name}/console${separator}type=vga`;
  }

  listSnapshots(name: string, project?: string): Promise<Instance[]> {
    return this.client.list<Instance>(`/instances/${name}/snapshots`, { project: project ?? projectFor(name) });
  }

  createSnapshot(name: string, snapName: string, stateful = false, project?: string): Promise<AsyncResponse | null> {
    return this.client.post(`/instances/${name}/snapshots${projectQueryFor(name, project)}`, { name: snapName, stateful });
  }

  restoreSnapshot(name: string, snapName: string, project?: string): Promise<AsyncResponse | null> {
    return this.client.put(`/instances/${name}/snapshots/${snapName}${projectQueryFor(name, project)}`, { restore: true });
  }

  deleteSnapshot(name: string, snapName: string, project?: string): Promise<void> {
    return this.client.delete(`/instances/${name}/snapshots/${snapName}${projectQueryFor(name, project)}`);
  }

  listLogs(name: string, project?: string): Promise<string[]> {
    return this.client.get<string[]>(`/instances/${name}/logs${projectQueryFor(name, project)}`);
  }

  readLog(name: string, file: string, project?: string): Promise<string> {
    return this.client.get<string>(`/instances/${name}/logs/${file}${projectQueryFor(name, project)}`);
  }

  copy(
    name: string,
    target: string,
    options?: { live?: boolean; pool?: string; sourceProject?: string; targetProject?: string }
  ): Promise<AsyncResponse | SyncResponse | null> {
    const source: { type: "copy"; source: string; project?: string } = { type: "copy", source: name };
    if (options?.sourceProject !== undefined) source.project = options.sourceProject;
    const body: { source: typeof source; name: string; live?: boolean; pool?: string } = {
      source,
      name: target,
    };
    if (options?.live !== undefined) body.live = options.live;
    if (options?.pool !== undefined) body.pool = options.pool;
    const query = options?.targetProject !== undefined
      ? `?project=${encodeURIComponent(options.targetProject)}`
      : projectQuery();
    return this.client.post(`/instances${query}`, body);
  }

  rename(name: string, newName: string, project?: string): Promise<AsyncResponse | SyncResponse | null> {
    return this.client.post(`/instances/${name}${projectQueryFor(name, project)}`, { name: newName });
  }

  move(
    name: string,
    body: { live?: boolean; pool?: string; project?: string; target?: string },
    sourceProject?: string
  ): Promise<AsyncResponse | SyncResponse | null> {
    const { target, ...rest } = body;
    // The query project addresses the SOURCE instance; body.project is the TARGET project.
    const projectQueryString = sourceProject !== undefined
      ? `?project=${encodeURIComponent(sourceProject)}`
      : projectQueryFor(name);
    const targetQuery = target ? `&target=${encodeURIComponent(target)}` : "";
    return this.client.post(`/instances/${name}${projectQueryString}${targetQuery}`, { migration: true, ...rest });
  }

  rebuild(name: string, body: { source: InstanceImageSource }, project?: string): Promise<AsyncResponse | SyncResponse | null> {
    return this.client.post(`/instances/${name}/rebuild${projectQueryFor(name, project)}`, body);
  }

  freeze(name: string, project?: string): Promise<AsyncResponse | null> {
    return this.setState(name, "freeze", false, project);
  }

  unfreeze(name: string, project?: string): Promise<AsyncResponse | null> {
    return this.setState(name, "unfreeze", false, project);
  }

  listBackups(name: string, project?: string): Promise<InstanceBackup[]> {
    return this.client.list<InstanceBackup>(`/instances/${name}/backups`, { project: project ?? projectFor(name) });
  }

  createBackup(name: string, backupName: string, project?: string): Promise<AsyncResponse | null> {
    return this.client.post(`/instances/${name}/backups${projectQueryFor(name, project)}`, { name: backupName });
  }

  deleteBackup(name: string, backupName: string, project?: string): Promise<void> {
    return this.client.delete(`/instances/${name}/backups/${backupName}${projectQueryFor(name, project)}`);
  }
}
