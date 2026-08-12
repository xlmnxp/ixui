import { projectQuery, type ApiClient } from "./client";

export class FilesApi {
  constructor(private client: ApiClient) {}

  get(instance: string, path: string): Promise<string> {
    return this.client.get<string>(`/instances/${instance}/files${projectQuery()}&path=${encodeURIComponent(path)}`);
  }

  put(instance: string, path: string, content: string): Promise<void> {
    return this.client.postRaw(
      `/instances/${instance}/files${projectQuery()}&path=${encodeURIComponent(path)}`,
      content,
      { "Content-Type": "text/plain" }
    );
  }

  remove(instance: string, path: string): Promise<void> {
    return this.client.delete(`/instances/${instance}/files${projectQuery()}&path=${encodeURIComponent(path)}`);
  }
}
