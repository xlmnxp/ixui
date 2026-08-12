import { currentProject, type ApiClient } from "./client";

function filesUrl(instance: string, path: string): string {
  const project = currentProject();
  const projectPart = project !== undefined ? `project=${encodeURIComponent(project)}&` : "";
  return `/instances/${instance}/files?${projectPart}path=${encodeURIComponent(path)}`;
}

export class FilesApi {
  constructor(private client: ApiClient) {}

  get(instance: string, path: string): Promise<string> {
    return this.client.get<string>(filesUrl(instance, path));
  }

  put(instance: string, path: string, content: string): Promise<void> {
    return this.client.postRaw(
      filesUrl(instance, path),
      content,
      { "Content-Type": "text/plain" }
    );
  }

  remove(instance: string, path: string): Promise<void> {
    return this.client.delete(filesUrl(instance, path));
  }
}
