import { projectListParam, type ApiClient } from "./client";
import type { Operation } from "./types";

export class OperationsApi {
  constructor(private client: ApiClient) {}

  list(): Promise<Operation[]> {
    return this.client.list<Operation>("/operations", projectListParam());
  }

  get(id: string): Promise<Operation> {
    return this.client.get<Operation>(`/operations/${id}`);
  }

  wait(id: string): Promise<Operation> {
    return this.client.get<Operation>(`/operations/${id}/wait`);
  }

  cancel(id: string): Promise<void> {
    return this.client.delete(`/operations/${id}`);
  }
}
