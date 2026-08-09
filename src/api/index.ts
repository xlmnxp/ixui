import { ApiClient } from "./client";
import { EventStream } from "./events";
import { InstancesApi } from "./instances";
import { InfraApi } from "./infra";
import { ServerApi } from "./server";
import { OperationsApi } from "./operations";
import { ClusterApi } from "./cluster";

export const api = new ApiClient("/1.0");
export const instancesApi = new InstancesApi(api);
export const infraApi = new InfraApi(api);
export const serverApi = new ServerApi(api);
export const operationsApi = new OperationsApi(api);
export const clusterApi = new ClusterApi(api);

export function eventsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/1.0/events?type=operation,lifecycle,logging`;
}

export const eventStream = new EventStream(eventsUrl());
