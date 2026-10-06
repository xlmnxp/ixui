/** Version and commit baked in at build time (see vite.config.ts). */
export const APP_VERSION: string = __APP_VERSION__;
export const APP_COMMIT: string = __APP_COMMIT__;

export function versionLabel(): string {
  return `v${APP_VERSION}`;
}

export function versionTitle(): string {
  return APP_COMMIT === "unknown" ? `ixui ${versionLabel()}` : `ixui ${versionLabel()} (${APP_COMMIT})`;
}
