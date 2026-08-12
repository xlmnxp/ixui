import { ApiError, type ApiClient } from "./client";

interface ErrorBody {
  error?: string;
  error_code?: number;
}

export class FilesApi {
  constructor(private client: ApiClient) {}

  get(instance: string, path: string): Promise<string> {
    return this.client.get<string>(`/instances/${instance}/files?path=${encodeURIComponent(path)}`);
  }

  async put(instance: string, path: string, content: string): Promise<void> {
    const res = await fetch(`/1.0/instances/${instance}/files?path=${encodeURIComponent(path)}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: content,
    });

    if (!res.ok) {
      let err: ErrorBody | null = null;
      try {
        err = (await res.json()) as ErrorBody;
      } catch {
        err = null;
      }
      throw new ApiError(res.status, err?.error_code, err?.error ?? res.statusText);
    }
  }

  remove(instance: string, path: string): Promise<void> {
    return this.client.delete(`/instances/${instance}/files?path=${encodeURIComponent(path)}`);
  }
}
