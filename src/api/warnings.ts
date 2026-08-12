import type { ApiClient } from "./client";

export interface Warning {
  uuid: string;
  location: string;
  node: string;
  project: string;
  entity_type: string;
  entity_id: string;
  type: string;
  message: string;
  status: string;
  severity: string;
  first_seen_at: string;
  last_seen_at: string;
  last_updated_at: string;
}

export class WarningsApi {
  constructor(private client: ApiClient) {}

  list(): Promise<Warning[]> {
    return this.client.list<Warning>("/warnings");
  }

  ack(id: string): Promise<void> {
    return this.client.put(`/warnings/${id}`, { acknowledged: true });
  }
}
