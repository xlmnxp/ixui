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

export class ApiClient {
  private forbiddenHandler: (() => void) | null = null;

  constructor(private basePath = "/1.0") {}

  setForbiddenHandler(handler: () => void): void {
    this.forbiddenHandler = handler;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.basePath}${path}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
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
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async list<T>(path: string, opts?: { project?: string }): Promise<T[]> {
    const project = opts?.project;
    const qs = project !== undefined
      ? `?project=${encodeURIComponent(project)}&recursion=1`
      : "?all-projects=true&recursion=1";
    const items = await this.request<(string | T)[]>("GET", `${path}${qs}`);
    return (items ?? []).filter((item): item is T => typeof item !== "string");
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async postRaw<T>(path: string, body: BodyInit, headers?: Record<string, string>): Promise<T> {
    const res = await fetch(`${this.basePath}${path}`, {
      method: "POST",
      headers: headers ?? { "Content-Type": "application/octet-stream" },
      body,
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
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  delete(path: string): Promise<void> {
    return this.request<void>("DELETE", path);
  }
}
