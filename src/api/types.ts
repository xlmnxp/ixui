export interface ServerInfo {
  api_extensions: string[];
  api_status: string;
  auth: string;
  environment: {
    server: string;
    server_version: string;
    project: string;
  };
}

export type InstanceStatus =
  | "Running"
  | "Started"
  | "Stopped"
  | "Frozen"
  | "Paused"
  | "Error"
  | "Starting"
  | "Stopping"
  | "Freezing"
  | "Unfreezing"
  | "Restarting"
  | "Migrating";

export interface Instance {
  name: string;
  status: InstanceStatus;
  type: "container" | "virtual-machine";
  description: string;
  created_at: string;
  last_used_at: string;
  config: Record<string, string>;
  devices: Record<string, Record<string, string>>;
  profiles: string[];
  project: string;
  location?: string;
  ephemeral: boolean;
}

export interface ClusterMember {
  server_name: string;
  url: string;
  database: boolean;
  status: string;
  message: string;
  architecture: string;
}

export interface Image {
  fingerprint: string;
  filename: string;
  description: string;
  public: boolean;
  created_at: string;
  size: number;
  type: "container" | "virtual-machine";
  properties: Record<string, string>;
}

export interface Profile {
  name: string;
  description: string;
  config: Record<string, string>;
  devices: Record<string, Record<string, string>>;
}

export interface Network {
  name: string;
  description: string;
  type: string;
  managed: boolean;
  used_by: string[];
  status: string;
}

export interface StoragePool {
  name: string;
  description: string;
  driver: string;
  status: string;
  used_by: string[];
}

export interface StorageVolume {
  name: string;
  type: string;
  content_type: string;
  used_by?: string[];
}

export interface Project {
  name: string;
  description: string;
  config: Record<string, string>;
}

export type OperationStatus = "Running" | "Success" | "Failure" | "Cancelled" | "Unknown";

export interface Operation {
  id: string;
  class: "task" | "websocket";
  description: string;
  status: OperationStatus;
  status_code: number;
  created_at: string;
  updated_at: string;
  may_cancel: boolean;
  err?: string;
  resources?: Record<string, string[]>;
  metadata?: Record<string, unknown>;
}

export interface AsyncResponse {
  type: "async";
  status: string;
  status_code: number;
  operation: string;
  metadata: Operation | null;
  err?: string;
}

export interface SyncResponse {
  type: "sync";
  status: string;
  status_code: number;
  metadata: unknown;
}

export interface InstanceStateInfo {
  status: InstanceStatus;
  cpu: { usage: number };
  memory: { usage: number };
  network?: Record<string, { addresses: { family: string; address: string; netmask: string }[] }>;
}
