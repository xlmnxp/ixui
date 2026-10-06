import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { incusProxy } from "./plugins/incus-proxy";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

function gitCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig(({ command }) => ({
  // Compile-time build info. Releases bump package.json before building, so the
  // number below is the released version; local `vite` runs are marked "-dev".
  define: {
    __APP_VERSION__: JSON.stringify(command === "serve" ? `${pkg.version}-dev` : pkg.version),
    __APP_COMMIT__: JSON.stringify(gitCommit()),
  },
  plugins: [react(), tailwindcss(), incusProxy()],
  base: "/ui/",
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./vitest.setup.ts",
    exclude: ["**/node_modules/**", "**/dist/**", ".worktrees/**", "**/.superpowers/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/vite-env.d.ts", "src/main.tsx", "src/App.tsx", "src/app-init.ts"],
      reporter: ["text", "html"],
    },
  },
}));
