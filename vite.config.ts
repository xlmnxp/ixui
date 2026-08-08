import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { incusProxy } from "./plugins/incus-proxy";

export default defineConfig({
  plugins: [react(), tailwindcss(), incusProxy()],
  base: "/ui/",
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./vitest.setup.ts",
  },
});
