import { createStore } from "./store";

/** Bumped to ask the sidebar to open the create-instance wizard (from the command palette). */
export const createInstanceRequestStore = createStore<number>(0);
export const requestCreateInstance = (): void => createInstanceRequestStore.setState((n) => n + 1);

/** Whether the command palette is open. */
export const paletteOpenStore = createStore<boolean>(false);
export const setPaletteOpen = (open: boolean): void => paletteOpenStore.setState(open);
