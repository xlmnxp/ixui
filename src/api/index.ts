import { ApiClient } from "./client";
import { InstancesApi } from "./instances";
import { InfraApi } from "./infra";
import { ServerApi } from "./server";
import { OperationsApi } from "./operations";

export const api = new ApiClient("/1.0");
export const instancesApi = new InstancesApi(api);
export const infraApi = new InfraApi(api);
export const serverApi = new ServerApi(api);
export const operationsApi = new OperationsApi(api);

export function eventsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/1.0/events?type=operation,lifecycle,logging`;
}
