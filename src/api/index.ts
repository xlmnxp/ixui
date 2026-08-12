import { ApiClient } from "./client";
import { EventStream } from "./events";
import { InstancesApi } from "./instances";
import { InfraApi } from "./infra";
import { ServerApi } from "./server";
import { OperationsApi } from "./operations";
import { ClusterApi } from "./cluster";
import { AuthApi } from "./auth";
import { CertificatesApi } from "./certificates";
import { BackupsApi } from "./backups";
import { FilesApi } from "./files";
import { ResourcesApi } from "./resources";
import { WarningsApi } from "./warnings";

export const api = new ApiClient("/1.0");
export const instancesApi = new InstancesApi(api);
export const infraApi = new InfraApi(api);
export const serverApi = new ServerApi(api);
export const operationsApi = new OperationsApi(api);
export const clusterApi = new ClusterApi(api);
export const authApi = new AuthApi(api);
export const certificatesApi = new CertificatesApi(api);
export const backupsApi = new BackupsApi(api);
export const filesApi = new FilesApi(api);
export const resourcesApi = new ResourcesApi(api);
export const warningsApi = new WarningsApi(api);

export function eventsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/1.0/events?type=operation,lifecycle,logging`;
}

export const eventStream = new EventStream(eventsUrl());
