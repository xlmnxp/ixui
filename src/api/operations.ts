import type { ApiClient } from "./client";
import type { Operation } from "./types";

export class OperationsApi {
  constructor(private client: ApiClient) {}

  get(id: string): Promise<Operation> {
    return this.client.get<Operation>(`/operations/${id}`);
  }

  wait(id: string): Promise<Operation> {
    return this.client.get<Operation>(`/operations/${id}/wait`);
  }
}
