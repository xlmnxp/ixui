import type { ApiClient } from "./client";
import type { AsyncResponse, SyncResponse } from "./types";

export interface Certificate {
  fingerprint: string;
  type: string;
  name: string;
  certificate: string;
  restricted: boolean;
  projects: string[];
}

export class CertificatesApi {
  constructor(private client: ApiClient) {}

  list(): Promise<Certificate[]> {
    return this.client.list<Certificate>("/certificates");
  }

  createToken(description: string, expiry: string): Promise<AsyncResponse | SyncResponse | null> {
    return this.client.post("/certificates", { type: "client", description, expiry });
  }

  delete(fingerprint: string): Promise<void> {
    return this.client.delete(`/certificates/${encodeURIComponent(fingerprint)}`);
  }
}
