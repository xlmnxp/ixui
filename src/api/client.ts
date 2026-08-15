import { markAuthenticated } from "../auth/status";

export const ALL_PROJECTS = "all";

let projectProvider: () => string = () => "default";

export function setProjectProvider(provider: () => string): void {
  projectProvider = provider;
}

export function currentProject(): string | undefined {
  const project = projectProvider();
  return project === ALL_PROJECTS ? undefined : project;
}

export function projectQuery(): string {
  const project = currentProject();
  return project === undefined ? "" : `?project=${encodeURIComponent(project)}`;
}

// One name can exist in several projects (e.g. "web1" in dev and prod), so the
// registry keeps a list per name. In all-projects mode a lookup only resolves when
// the name is unambiguous; callers that know the project must pass it explicitly.
const instanceProjects: Record<string, string[]> = {};

export function registerInstanceProject(name: string, project: string): void {
  const projects = instanceProjects[name];
  if (projects === undefined) instanceProjects[name] = [project];
  else if (!projects.includes(project)) projects.push(project);
}

export function unregisterInstanceProject(name: string, project?: string): void {
  const projects = instanceProjects[name];
  if (projects === undefined) return;
  if (project === undefined) {
    delete instanceProjects[name];
    return;
  }
  const next = projects.filter((p) => p !== project);
  if (next.length === 0) delete instanceProjects[name];
  else instanceProjects[name] = next;
}

/** Drop one project from every name's registry entry (used before re-registering a reloaded list). */
export function removeInstanceProject(project: string): void {
  for (const name of Object.keys(instanceProjects)) unregisterInstanceProject(name, project);
}

export function resetInstanceProjects(): void {
  for (const name of Object.keys(instanceProjects)) delete instanceProjects[name];
}

export function projectFor(name: string): string | undefined {
  const current = currentProject();
  if (current !== undefined) return current;
  const projects = instanceProjects[name];
  if (projects === undefined || projects.length === 0) return undefined;
  if (projects.length === 1) return projects[0];
  return undefined; // ambiguous — caller must pass an explicit project
}

export function projectQueryFor(name: string, project?: string): string {
  const resolved = project ?? projectFor(name);
  return resolved === undefined ? "" : `?project=${encodeURIComponent(resolved)}`;
}

export function projectListParam(): { project?: string; allProjects?: boolean } {
  const project = currentProject();
  return project === undefined ? { allProjects: true } : { project };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: number | undefined,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorBody {
  error?: string;
  error_code?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

interface SendOptions {
  method: string;
  body?: BodyInit;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export class ApiClient {
  private forbiddenHandler: (() => void) | null = null;

  constructor(private basePath = "/1.0") {}

  setForbiddenHandler(handler: () => void): void {
    this.forbiddenHandler = handler;
  }

  private async send<T>(path: string, options: SendOptions): Promise<T> {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.basePath}${path}`, {
        method: options.method,
        headers: options.headers ?? (options.body !== undefined ? { "Content-Type": "application/json" } : undefined),
        body: options.body,
        signal: controller.signal,
      });

      if (res.status === 401) this.forbiddenHandler?.();

      const text = await res.text();
      let json: unknown = null;
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          json = text;
        }
      }

      if (!res.ok) {
        const err = json as ErrorBody | null;
        throw new ApiError(res.status, err?.error_code, err?.error ?? res.statusText);
      }
      markAuthenticated();
      if (json && typeof json === "object" && (json as { type?: unknown }).type === "sync") {
        json = (json as { metadata: unknown }).metadata;
      }
      return json as T;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new ApiError(0, undefined, `Request timed out after ${Math.round(timeoutMs / 1000)}s`);
      }
      throw err;
    } finally {
      window.clearTimeout(timer);
    }
  }

  private request<T>(method: string, path: string, body?: unknown): Promise<T> {
    return this.send<T>(path, {
      method,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async list<T>(path: string, opts?: { project?: string; allProjects?: boolean }): Promise<T[]> {
    const project = opts?.project;
    const qs = project !== undefined
      ? `?project=${encodeURIComponent(project)}&recursion=1`
      : opts?.allProjects
        ? "?all-projects=true&recursion=1"
        : "?recursion=1";
    const items = await this.request<(string | T)[]>("GET", `${path}${qs}`);
    return (items ?? []).filter((item): item is T => typeof item !== "string");
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  postRaw<T>(path: string, body: BodyInit, headers?: Record<string, string>): Promise<T> {
    return this.send<T>(path, {
      method: "POST",
      body,
      headers: headers ?? { "Content-Type": "application/octet-stream" },
    });
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  putRaw<T>(path: string, body: BodyInit, headers?: Record<string, string>): Promise<T> {
    return this.send<T>(path, {
      method: "PUT",
      body,
      headers: headers ?? { "Content-Type": "application/octet-stream" },
    });
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  delete(path: string): Promise<void> {
    return this.request<void>("DELETE", path);
  }
}
