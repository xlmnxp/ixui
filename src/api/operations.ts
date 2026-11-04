import { projectListParam, type ApiClient } from "./client";
import type { Operation } from "./types";

const TERMINAL = new Set(["Success", "Failure", "Cancelled"]);

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

  /**
   * Poll until the operation reaches a terminal state.
   *
   * The daemon also offers GET /operations/{id}/wait, but that long-poll is
   * capped by the client's request timeout, so any real-world create (image
   * download) aborted after 30s and looked like a failure while the operation
   * kept running. Polling has no such cap and reports progress as it goes.
   */
  async wait(
    id: string,
    opts: { intervalMs?: number; timeoutMs?: number; onUpdate?: (operation: Operation) => void } = {}
  ): Promise<Operation> {
    const intervalMs = opts.intervalMs ?? 1_000;
    const timeoutMs = opts.timeoutMs ?? 15 * 60_000;
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const operation = await this.get(id);
      opts.onUpdate?.(operation);
      // status_code >= 200 covers Success (200), Failure (400) and Cancelled (401);
      // the status words are a fallback for responses without a code.
      if (operation.status_code >= 200 || TERMINAL.has(operation.status ?? "")) return operation;
      // A response with neither a code nor a status has nothing left to wait for.
      if (typeof operation.status_code !== "number" && !operation.status) return operation;
      if (Date.now() >= deadline) return operation;
      await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    }
  }

  cancel(id: string): Promise<void> {
    return this.client.delete(`/operations/${this.id(id)}`);
  }
}
