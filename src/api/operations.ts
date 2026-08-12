import { projectListParam, type ApiClient } from "./client";
import type { Operation } from "./types";

export class OperationsApi {
  constructor(private client: ApiClient) {}

  private id(pathOrId: string): string {
    return pathOrId.includes("/") ? pathOrId.slice(pathOrId.lastIndexOf("/") + 1) : pathOrId;
  }

  list(): Promise<Operation[]> {
    return this.client.list<Operation>("/operations", projectListParam());
  }

  get(id: string): Promise<Operation> {
    return this.client.get<Operation>(`/operations/${this.id(id)}`);
  }

  wait(id: string): Promise<Operation> {
    return this.client.get<Operation>(`/operations/${this.id(id)}/wait`);
  }

  cancel(id: string): Promise<void> {
    return this.client.delete(`/operations/${this.id(id)}`);
  }
}
