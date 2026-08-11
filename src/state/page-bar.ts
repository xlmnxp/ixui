import type { ReactNode } from "react";
import { createStore } from "./store";

export interface PageBarState {
  title: ReactNode;
  actions?: ReactNode[];
}

export const pageBarStore = createStore<PageBarState | null>(null);

export function registerPageBar(bar: PageBarState | null): () => void {
  pageBarStore.setState(bar);
  return () => {
    pageBarStore.setState((current) => (current === bar ? null : current));
  };
}
