import { createStore } from "./store";
import type { Operation } from "../api/types";

export const operationsStore = createStore<Operation[]>([]);

export function applyOperationEvent(
  state: Operation[],
  meta: { id: string; operation: Operation }
): Operation[] {
  const existing = state.find((o) => o.id === meta.id);
  if (!existing) return [meta.operation, ...state];
  return state.map((o) => (o.id === meta.id ? meta.operation : o));
}

export function dismissOperation(id: string): void {
  operationsStore.setState((prev) => prev.filter((o) => o.id !== id));
}
