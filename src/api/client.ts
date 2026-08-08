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

    if (res.status === 403) this.forbiddenHandler?.();

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
    return json as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async list<T>(path: string): Promise<T[]> {
    const items = await this.request<(string | T)[]>("GET", `${path}?recursion=1`);
    return items.filter((item): item is T => typeof item !== "string");
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  delete(path: string): Promise<void> {
    return this.request<void>("DELETE", path);
  }
}
