import { projectFor, type ApiClient } from "./client";

function filesUrl(instance: string, path: string, project?: string): string {
  const resolved = project ?? projectFor(instance);
  const projectPart = resolved !== undefined ? `project=${encodeURIComponent(resolved)}&` : "";
  return `/instances/${instance}/files?${projectPart}path=${encodeURIComponent(path)}`;
}

export type FileEntryType = "file" | "directory" | "symlink";

export interface FileStat {
  type: FileEntryType | null;
  size: number | null;
  modified: string | null;
}

function normalizeType(value: string | null): FileEntryType | null {
  return value === "file" || value === "directory" || value === "symlink" ? value : null;
}

export class FilesApi {
  constructor(private client: ApiClient) {}

  /**
   * Returns the directory listing (array of entry name strings) when path is
   * a directory, or the raw file contents (string) when it is a file.
   */
  read(instance: string, path: string, project?: string): Promise<string | string[]> {
    return this.client.get<string | string[]>(filesUrl(instance, path, project));
  }

  get(instance: string, path: string, project?: string): Promise<string | string[]> {
    return this.read(instance, path, project);
  }

  /** Cheap per-entry metadata via HEAD (type, size, modified). */
  async stat(instance: string, path: string, project?: string): Promise<FileStat> {
    const headers = await this.client.head(filesUrl(instance, path, project));
    const length = headers.get("content-length");
    return {
      type: normalizeType(headers.get("x-incus-type")),
      size: length !== null && length !== "" && !Number.isNaN(Number(length)) ? Number(length) : null,
      modified: headers.get("x-incus-modified") ?? headers.get("last-modified"),
    };
  }

  /** Overwrite the contents of an existing file (PUT). */
  put(instance: string, path: string, content: string, project?: string): Promise<void> {
    return this.client.putRaw(filesUrl(instance, path, project), content, { "Content-Type": "application/octet-stream" });
  }

  /** Create a new file under parent (POST with X-Incus-Type/X-Incus-Name). */
  create(instance: string, parent: string, name: string, content: BodyInit, project?: string): Promise<void> {
    return this.client.postRaw(filesUrl(instance, parent, project), content, {
      "Content-Type": "application/octet-stream",
      "X-Incus-Type": "file",
      "X-Incus-Name": name,
    });
  }

  /** Create a new directory under parent. */
  mkdir(instance: string, parent: string, name: string, project?: string): Promise<void> {
    return this.client.postRaw(filesUrl(instance, parent, project), "", {
      "Content-Type": "application/octet-stream",
      "X-Incus-Type": "directory",
      "X-Incus-Name": name,
    });
  }

  remove(instance: string, path: string, project?: string): Promise<void> {
    return this.client.delete(filesUrl(instance, path, project));
  }

  /** Absolute URL for browser-side downloads (relative to the UI origin). */
  downloadUrl(instance: string, path: string, project?: string): string {
    return `/1.0${filesUrl(instance, path, project)}`;
  }
}
