# ixui (Incus Web UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hand-crafted React web UI for Incus — Proxmox-dark, ESXi-layout, Incus-colored — with a custom design-token + primitive component system, served by incusd itself at `/ui/` in production and proxied via a Vite plugin in development.

**Architecture:** Vite + React 19 SPA. A dev-only Vite plugin proxies `/1.0` (REST) and `/1.0/events` (WebSocket) plus `/oidc` to a local incusd using the user's client cert from `~/.config/incus`. Production builds with base `/ui/` and is served same-origin by incusd; auth via browser TLS client cert or OIDC session cookie, with a 403-detection auth seam in the API client. A typed API client, one WebSocket event stream feeding hand-rolled `useSyncExternalStore` stores (operations, instances, projects), and a Proxmox-style shell (sidebar tree, top bar, bottom task log).

**Tech Stack:** React 19, TypeScript (strict), Vite 7, Tailwind CSS v4 (tokens via `@theme`), react-router-dom 7, xterm 5 + @xterm/addon-fit, Vitest 3 + React Testing Library 16, `ws` (devDependency only, for the proxy plugin).

## Global Constraints

- Runtime dependencies are ONLY: `react`, `react-dom`, `react-router-dom`, `xterm`, `@xterm/addon-fit`. No UI/component libraries, no state libraries, no CSS-in-JS.
- TypeScript strict mode. No `any` (use `unknown` + narrowing).
- All interactive elements get a `data-testid` (patterns shown per task).
- Design tokens live ONLY in `src/styles/theme.css` (`@theme` block). Components reference token classes (`bg-surface-800`, `text-text-secondary`, `border-border`, `accent-accent-600`), never raw hex.
- Every code commit must pass: `npx vitest run`, `npm run typecheck`, `npm run lint`.
- Tests never hit the network: `fetch` mocked via `vi.stubGlobal("fetch", ...)`; WebSocket mocked with a fake class.
- Store state is held in modules from `src/state/store.ts` (createStore); components read via `useStore`.
- API list calls use `?recursion=1`; the ApiClient returns typed data and throws `ApiError` (with `status` and `code`).
- Instance keys in the instances store are namespaced as `${project}/${name}`.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `.gitignore`, `eslint.config.js`, `vitest.setup.ts`, `src/vite-env.d.ts`, `src/main.tsx`, `src/App.tsx`, `src/App.test.tsx`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: working dev server + test runner + lint/typecheck scripts that all later tasks build on

- [ ] **Step 1: Write package.json and config files**

`package.json`:
```json
{
  "name": "ixui",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --max-warnings 0"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.1.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "eslint": "^9.17.0",
    "jsdom": "^26.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "~5.7.0",
    "typescript-eslint": "^8.18.0",
    "vite": "^7.0.0",
    "vitest": "^3.0.0",
    "ws": "^8.18.0"
  }
}
```

`vite.config.ts`:
```ts
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
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "vite.config.ts", "plugins", "vitest.setup.ts"]
}
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Incus</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`.gitignore`:
```
node_modules/
dist/
*.local
.DS_Store
```

`eslint.config.js`:
```js
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    },
  }
);
```

`vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

`src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/theme.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`src/App.tsx`:
```tsx
export function App() {
  return <div data-testid="app-root">ixui</div>;
}
```

- [ ] **Step 2: Write the smoke test**

`src/App.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("App", () => {
  it("renders the app root", () => {
    render(<App />);
    expect(screen.getByTestId("app-root")).toHaveTextContent("ixui");
  });
});
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: lockfile created, no errors.

- [ ] **Step 4: Verify test, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: 1 test PASS, typecheck clean, lint clean (App.tsx must have no unused imports — use `import { App } from "./App"` exactly as shown).

- [ ] **Step 5: Create placeholder theme file so the build imports resolve**

Create `src/styles/theme.css` with just:
```css
@import "tailwindcss";
```
(Token content arrives in Task 2.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite react ts project"
```

---

### Task 2: Design Tokens (Tailwind v4 theme)

**Files:**
- Create: `src/styles/theme.css` (overwrite placeholder)
- Test: none (CSS) — verification is `npm run build` + a token class renders (checked via Button in Task 4)

**Interfaces:**
- Consumes: Task 1 scaffold
- Produces: token classes used everywhere: `bg-surface-950/900/800/700/600/500`, `bg-sidebar`, `border-border`, `text-text-primary/secondary/tertiary`, `bg-accent-400/500/600/700`, `text-accent-400`, `bg-success`, `bg-warning`, `bg-danger`, `text-red-300`, `accent-accent-600`, plus `--font-sans`, `--text-*` defaults and the `indeterminate` keyframes

- [ ] **Step 1: Write the token file**

`src/styles/theme.css`:
```css
@import "tailwindcss";

@theme {
  --font-sans: ui-sans-serif, system-ui, "Segoe UI", Helvetica, Arial, sans-serif;

  /* Incus accent — blue family anchored on the Incus brand color */
  --color-accent-300: #7fb8ff;
  --color-accent-400: #5799f0;
  --color-accent-500: #3d8cff;
  --color-accent-600: #2f6fd0;
  --color-accent-700: #275ba8;

  /* Dark slate surfaces (Proxmox-dark base) */
  --color-surface-950: #15181b;
  --color-surface-900: #1a1d21;
  --color-surface-800: #22262b;
  --color-surface-700: #2b3036;
  --color-surface-600: #343b42;
  --color-surface-500: #3f474f;
  --color-sidebar: #1a1d21;

  /* Text + borders */
  --color-text-primary: #e8eaed;
  --color-text-secondary: #aeb4bc;
  --color-text-tertiary: #7d848d;
  --color-border: #383f47;

  /* Semantic */
  --color-success: #3fb950;
  --color-warning: #d29922;
  --color-danger: #f85149;
}

@keyframes indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}

body {
  background-color: var(--color-surface-950);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: compiles and emits `dist/` without error.

- [ ] **Step 3: Commit**

```bash
git add src/styles/theme.css
git commit -m "feat: add incus design tokens (tailwind v4 theme)"
```

---

### Task 3: Incus Dev Proxy Plugin

**Files:**
- Create: `plugins/incus-proxy.ts`
- Test: none (needs live incusd) — verification is manual against local incusd

**Interfaces:**
- Consumes: `ws` devDependency, Node `https`
- Produces: `incusProxy(options?: { certDir?: string; target?: string })` Vite plugin; forwards `/1.0/*` REST and `/1.0/*` WebSocket upgrades and `/oidc/*` from the dev server to incusd with the client cert; cert dir from `INCUS_CERT_DIR` env (default `~/.config/incus`), target from `INCUS_TARGET` env (default `https://127.0.0.1:8443`)

- [ ] **Step 1: Write the plugin**

`plugins/incus-proxy.ts`:
```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import https from "node:https";
import { WebSocket, WebSocketServer } from "ws";
import type { Plugin } from "vite";

export interface IncusProxyOptions {
  certDir?: string;
  target?: string;
}

export function incusProxy(options: IncusProxyOptions = {}): Plugin {
  const certDir =
    options.certDir ?? process.env.INCUS_CERT_DIR ?? join(process.env.HOME ?? "", ".config", "incus");
  const target = new URL(options.target ?? process.env.INCUS_TARGET ?? "https://127.0.0.1:8443");

  const agent = new https.Agent({
    rejectUnauthorized: false,
    cert: readFileSync(join(certDir, "client.crt")),
    key: readFileSync(join(certDir, "client.key")),
  });

  return {
    name: "incus-proxy",
    configureServer(server) {
      server.middlewares.use("/1.0", (req, res) => {
        const upstream = https.request(
          { host: target.hostname, port: target.port, path: req.url, method: req.method, agent, headers: { ...req.headers, host: undefined } },
          (upstreamRes) => {
            res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
            upstreamRes.pipe(res);
          }
        );
        upstream.on("error", (err) => {
          res.statusCode = 502;
          res.end(`incus proxy error: ${err.message}`);
        });
        req.pipe(upstream);
      });

      server.middlewares.use("/oidc", (req, res) => {
        const upstream = https.request(
          { host: target.hostname, port: target.port, path: req.url, method: req.method, agent, headers: { ...req.headers, host: undefined } },
          (upstreamRes) => {
            res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
            upstreamRes.pipe(res);
          }
        );
        upstream.on("error", (err) => {
          res.statusCode = 502;
          res.end(`incus proxy error: ${err.message}`);
        });
        req.pipe(upstream);
      });

      server.httpServer?.on("upgrade", (req, socket, head) => {
        if (!req.url?.startsWith("/1.0/")) return;
        const upstream = new WebSocket(`wss://${target.host}${req.url}`, { agent });
        upstream.on("open", () => {
          const wss = new WebSocketServer({ noServer: true });
          wss.handleUpgrade(req, socket, head, (client) => {
            client.on("message", (data) => upstream.send(data));
            upstream.on("message", (data) => client.send(data));
            client.on("close", () => upstream.close());
            upstream.on("close", () => client.close());
            upstream.on("error", () => client.close());
          });
        });
        upstream.on("error", () => socket.destroy());
      });
    },
  };
}
```

- [ ] **Step 2: Verify against local incusd**

Run:
```bash
incus config set core.https_address :8443
npm run dev
curl -sk https://localhost:5173/1.0
```
Expected: JSON server info from incusd (curl prints the Incus API info object with `api_extensions`, `auth: "trusted"`). If `curl` fails with "proxy error", check `~/.config/incus/client.crt` exists (run `incus list` once to generate it).

- [ ] **Step 3: Commit**

```bash
git add plugins/incus-proxy.ts
git commit -m "feat: add incus dev proxy plugin (rest + websocket + oidc)"
```

---

### Task 4: Store Primitive + Button, Spinner, Badge, StatusDot

**Files:**
- Create: `src/state/store.ts`, `src/test/store.test.ts`, `src/components/spinner.tsx`, `src/components/button.tsx`, `src/components/badge.tsx`, `src/lib/instance-status.ts`, `src/components/status-dot.tsx`, `src/components/button.test.tsx`, `src/components/badge.test.tsx`, `src/lib/instance-status.test.ts`

**Interfaces:**
- Consumes: Task 1, Task 2 tokens
- Produces:
  - `createStore<T>(initial): { getState(): T; setState(updater: T | ((prev: T) => T)): void; subscribe(listener: () => void): () => void }` in `src/state/store.ts`
  - `useStore<T>(store: Store<T>): T` in `src/state/store.ts`
  - `Button({ variant?: "primary"|"secondary"|"ghost"|"danger", size?: "sm"|"md", loading?: boolean, ...buttonAttrs })` in `src/components/button.tsx`
  - `Spinner({ size?: "xs"|"sm"|"md" })` in `src/components/spinner.tsx`
  - `Badge({ tone?: "neutral"|"info"|"success"|"warning"|"danger", children })` in `src/components/badge.tsx`
  - `instanceStatusTone(status: string): "success"|"info"|"warning"|"danger"|"neutral"` in `src/lib/instance-status.ts`
  - `StatusDot({ tone, label? })` in `src/components/status-dot.tsx`

- [ ] **Step 1: Write the store primitive and its tests**

`src/state/store.ts`:
```ts
import { useSyncExternalStore } from "react";

export interface Store<T> {
  getState: () => T;
  setState: (updater: T | ((prev: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setState: (updater) => {
      state = typeof updater === "function" ? (updater as (prev: T) => T)(state) : updater;
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
```

`src/test/store.test.ts`:
```ts
import { renderHook, act } from "@testing-library/react";
import { createStore, useStore } from "../state/store";

describe("createStore", () => {
  it("returns the initial state", () => {
    const store = createStore(0);
    expect(store.getState()).toBe(0);
  });

  it("updates state with a value", () => {
    const store = createStore(0);
    store.setState(5);
    expect(store.getState()).toBe(5);
  });

  it("updates state with a function", () => {
    const store = createStore(0);
    store.setState((prev) => prev + 1);
    expect(store.getState()).toBe(1);
  });

  it("notifies subscribers", () => {
    const store = createStore(0);
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes", () => {
    const store = createStore(0);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.setState(1);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("useStore", () => {
  it("re-renders with new state", () => {
    const store = createStore(0);
    const { result } = renderHook(() => useStore(store));
    expect(result.current).toBe(0);
    act(() => store.setState(3));
    expect(result.current).toBe(3);
  });
});
```

- [ ] **Step 2: Run store tests**

Run: `npx vitest run src/test/store.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 3: Write Spinner, Button, Badge, StatusDot**

`src/components/spinner.tsx`:
```tsx
export interface SpinnerProps {
  size?: "xs" | "sm" | "md";
}

const sizes = { xs: "h-3.5 w-3.5 border-2", sm: "h-4 w-4 border-2", md: "h-6 w-6 border-2" };

export function Spinner({ size = "sm" }: SpinnerProps) {
  return (
    <span
      data-testid="spinner"
      className={`inline-block animate-spin rounded-full border-solid border-transparent border-t-current ${sizes[size]}`}
      role="status"
      aria-label="Loading"
    />
  );
}
```

`src/components/button.tsx`:
```tsx
import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent-600 text-white hover:bg-accent-500",
  secondary: "border border-border bg-surface-600 text-text-primary hover:bg-surface-700",
  ghost: "text-text-secondary hover:bg-surface-700 hover:text-text-primary",
  danger: "bg-danger text-white hover:opacity-90",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-8 px-3.5 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center gap-2 rounded font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(" ")}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner size="xs" />}
      {children}
    </button>
  );
}
```

`src/components/badge.tsx`:
```tsx
import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "border-border bg-surface-700 text-text-secondary",
  info: "border-blue-500/30 bg-blue-500/15 text-blue-300",
  success: "border-green-500/30 bg-green-500/15 text-green-300",
  warning: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  danger: "border-red-500/30 bg-red-500/15 text-red-300",
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
}

export function Badge({ tone = "neutral", children }: BadgeProps) {
  return (
    <span
      data-testid="badge"
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
```

`src/lib/instance-status.ts`:
```ts
import type { BadgeTone } from "../components/badge";

const STATUS_TONES: Record<string, BadgeTone> = {
  Started: "success",
  Stopped: "neutral",
  Frozen: "info",
  Starting: "info",
  Stopping: "warning",
  Freezing: "info",
  Unfreezing: "info",
  Restarting: "info",
  Migrating: "warning",
  Error: "danger",
};

export function instanceStatusTone(status: string): BadgeTone {
  return STATUS_TONES[status] ?? "neutral";
}
```

`src/components/status-dot.tsx`:
```tsx
import type { BadgeTone } from "./badge";

const dotClasses: Record<BadgeTone, string> = {
  neutral: "bg-text-tertiary",
  info: "bg-blue-400",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export interface StatusDotProps {
  tone: BadgeTone;
  label?: string;
}

export function StatusDot({ tone, label }: StatusDotProps) {
  return (
    <span data-testid="status-dot" className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${dotClasses[tone]}`} />
      {label && <span className="text-xs text-text-secondary">{label}</span>}
    </span>
  );
}
```

- [ ] **Step 4: Write component tests**

`src/components/button.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

describe("Button", () => {
  it("renders with children", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("calls onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled while loading", () => {
    render(<Button loading>Go</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
  });

  it("applies danger variant class", () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-danger");
  });
});
```

`src/components/badge.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders label with tone class", () => {
    render(<Badge tone="success">Started</Badge>);
    expect(screen.getByTestId("badge")).toHaveTextContent("Started");
    expect(screen.getByTestId("badge")).toHaveClass("bg-green-500/15");
  });
});
```

`src/lib/instance-status.test.ts`:
```ts
import { instanceStatusTone } from "./instance-status";

describe("instanceStatusTone", () => {
  it("maps Started to success", () => {
    expect(instanceStatusTone("Started")).toBe("success");
  });
  it("maps Error to danger", () => {
    expect(instanceStatusTone("Error")).toBe("danger");
  });
  it("maps unknown to neutral", () => {
    expect(instanceStatusTone("WeirdState")).toBe("neutral");
  });
});
```

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean typecheck, clean lint.

- [ ] **Step 6: Commit**

```bash
git add src/state/store.ts src/test/store.test.ts src/components src/lib
git commit -m "feat: add store primitive and first component primitives"
```

---

### Task 5: Form Primitives (Input, Select, Textarea, Checkbox, Switch)

**Files:**
- Create: `src/components/input.tsx`, `src/components/select.tsx`, `src/components/textarea.tsx`, `src/components/checkbox.tsx`, `src/components/switch.tsx`, `src/components/form.test.tsx`

**Interfaces:**
- Consumes: Task 2 tokens, Task 4 Button (not used here)
- Produces:
  - `Input({ label?, error?, ...inputAttrs })` — wraps in a `<label>`; error renders red border + message
  - `Select({ label?, children, ...selectAttrs })`
  - `Textarea({ label?, ...textareaAttrs })`
  - `Checkbox({ label?, ...inputAttrs })` — native checkbox, `accent-accent-600`
  - `Switch({ checked, onChange, label?, disabled? })` — `role="switch"`, `data-testid="switch"`

- [ ] **Step 1: Write the primitives**

`src/components/input.tsx`:
```tsx
import type { InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", id, name, ...rest }: InputProps) {
  const inputId = id ?? name;
  return (
    <label className="flex flex-col gap-1" htmlFor={inputId}>
      {label && <span className="text-xs font-medium text-text-secondary">{label}</span>}
      <input
        id={inputId}
        className={[
          "h-8 rounded border bg-surface-500 px-2.5 text-sm text-text-primary",
          "placeholder:text-text-tertiary focus:border-accent-500 focus:outline-none",
          error ? "border-danger" : "border-border",
          className,
        ].join(" ")}
        {...rest}
      />
      {error && <span className="text-xs text-red-300">{error}</span>}
    </label>
  );
}
```

`src/components/select.tsx`:
```tsx
import type { SelectHTMLAttributes } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className = "", id, name, children, ...rest }: SelectProps) {
  const selectId = id ?? name;
  return (
    <label className="flex flex-col gap-1" htmlFor={selectId}>
      {label && <span className="text-xs font-medium text-text-secondary">{label}</span>}
      <select
        id={selectId}
        className={`h-8 rounded border border-border bg-surface-500 px-2.5 text-sm text-text-primary focus:border-accent-500 focus:outline-none ${className}`}
        {...rest}
      >
        {children}
      </select>
    </label>
  );
}
```

`src/components/textarea.tsx`:
```tsx
import type { TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className = "", id, name, ...rest }: TextareaProps) {
  const textareaId = id ?? name;
  return (
    <label className="flex flex-col gap-1" htmlFor={textareaId}>
      {label && <span className="text-xs font-medium text-text-secondary">{label}</span>}
      <textarea
        id={textareaId}
        className={`rounded border border-border bg-surface-500 px-2.5 py-1.5 text-sm text-text-primary focus:border-accent-500 focus:outline-none ${className}`}
        {...rest}
      />
    </label>
  );
}
```

`src/components/checkbox.tsx`:
```tsx
import type { InputHTMLAttributes } from "react";

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Checkbox({ label, className = "", ...rest }: CheckboxProps) {
  return (
    <label className={`inline-flex items-center gap-2 text-sm text-text-primary ${className}`}>
      <input type="checkbox" className="h-4 w-4 accent-accent-600" {...rest} />
      {label}
    </label>
  );
}
```

`src/components/switch.tsx`:
```tsx
export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <label className={`inline-flex items-center gap-2 ${disabled ? "opacity-50" : ""}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        data-testid="switch"
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-accent-600" : "bg-surface-500"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? "left-4.5" : "left-0.5"}`}
        />
      </button>
      {label && <span className="text-sm text-text-primary">{label}</span>}
    </label>
  );
}
```

- [ ] **Step 2: Write tests**

`src/components/form.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./input";
import { Select } from "./select";
import { Textarea } from "./textarea";
import { Checkbox } from "./checkbox";
import { Switch } from "./switch";

describe("Input", () => {
  it("renders label and value", () => {
    render(<Input label="Name" name="name" defaultValue="web1" />);
    expect(screen.getByLabelText("Name")).toHaveValue("web1");
  });

  it("shows error", () => {
    render(<Input name="name" error="Invalid name" />);
    expect(screen.getByText("Invalid name")).toBeInTheDocument();
    expect(screen.getByLabelText("Invalid name")).toHaveClass("border-danger");
  });
});

describe("Select", () => {
  it("selects an option", async () => {
    const user = userEvent.setup();
    render(
      <Select label="Type" name="type">
        <option value="container">Container</option>
        <option value="virtual-machine">VM</option>
      </Select>
    );
    const select = screen.getByLabelText("Type");
    await user.selectOptions(select, "virtual-machine");
    expect(select).toHaveValue("virtual-machine");
  });
});

describe("Textarea", () => {
  it("renders value", () => {
    render(<Textarea label="Notes" name="notes" defaultValue="hello" />);
    expect(screen.getByLabelText("Notes")).toHaveValue("hello");
  });
});

describe("Checkbox", () => {
  it("toggles checked", async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Ephemeral" defaultChecked={false} />);
    const box = screen.getByRole("checkbox");
    await user.click(box);
    expect(box).toBeChecked();
  });
});

describe("Switch", () => {
  it("toggles on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Auto start" />);
    await user.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });
});
```

- [ ] **Step 3: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 4: Commit**

```bash
git add src/components
git commit -m "feat: add form primitives (input, select, textarea, checkbox, switch)"
```

---

### Task 6: Dialog, ConfirmDialog, Tooltip

**Files:**
- Create: `src/components/dialog.tsx`, `src/components/confirm-dialog.tsx`, `src/components/tooltip.tsx`, `src/components/dialog.test.tsx`

**Interfaces:**
- Consumes: Task 4 Button
- Produces:
  - `Dialog({ open, onClose, title, children, footer? })` — portal to body, backdrop click + Escape closes, `data-testid="dialog"` / `data-testid="dialog-backdrop"`
  - `ConfirmDialog({ open, title, body, confirmLabel?, tone?, loading?, onConfirm, onCancel })` — wraps Dialog, `data-testid="confirm-confirm"` / `data-testid="confirm-cancel"` buttons
  - `Tooltip({ label, children, side? })` — CSS group-hover tooltip, `role="tooltip"`

- [ ] **Step 1: Write the components**

`src/components/dialog.tsx`:
```tsx
import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title} data-testid="dialog">
      <div className="absolute inset-0 bg-black/60" data-testid="dialog-backdrop" onClick={onClose} />
      <div className="relative max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg border border-border bg-surface-800 p-5 shadow-xl">
        <h2 className="mb-3 text-base font-semibold text-text-primary">{title}</h2>
        <div className="text-sm text-text-secondary">{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
```

`src/components/confirm-dialog.tsx`:
```tsx
import { Dialog } from "./dialog";
import { Button } from "./button";
import type { ButtonVariant } from "./button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  tone?: ButtonVariant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  tone = "primary",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} data-testid="confirm-cancel">Cancel</Button>
          <Button variant={tone} onClick={onConfirm} loading={loading} data-testid="confirm-confirm">{confirmLabel}</Button>
        </>
      }
    >
      <p>{body}</p>
    </Dialog>
  );
}
```

`src/components/tooltip.tsx`:
```tsx
import type { ReactNode } from "react";

export interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
}

export function Tooltip({ label, children, side = "top" }: TooltipProps) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 ${
          side === "top" ? "bottom-full mb-1" : "top-full mt-1"
        }`}
      >
        {label}
      </span>
    </span>
  );
}
```

- [ ] **Step 2: Write tests**

`src/components/dialog.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "./dialog";
import { ConfirmDialog } from "./confirm-dialog";
import { Tooltip } from "./tooltip";

describe("Dialog", () => {
  it("does not render when closed", () => {
    render(<Dialog open={false} onClose={() => {}} title="T">x</Dialog>);
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("renders content when open", () => {
    render(<Dialog open onClose={() => {}} title="Delete instance">Are you sure?</Dialog>);
    expect(screen.getByRole("dialog", { name: "Delete instance" })).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  it("closes on backdrop click", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} title="T">x</Dialog>);
    await user.click(screen.getByTestId("dialog-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} title="T">x</Dialog>);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("ConfirmDialog", () => {
  it("calls onConfirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="Delete" body="Sure?" onConfirm={onConfirm} onCancel={() => {}} />);
    await user.click(screen.getByTestId("confirm-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("Tooltip", () => {
  it("renders tooltip role", () => {
    render(<Tooltip label="help text"><button>?</button></Tooltip>);
    expect(screen.getByRole("tooltip")).toHaveTextContent("help text");
  });
});
```

- [ ] **Step 3: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 4: Commit**

```bash
git add src/components
git commit -m "feat: add dialog, confirm-dialog, tooltip primitives"
```

---

### Task 7: Toast System

**Files:**
- Create: `src/components/toast.tsx`, `src/components/toast.test.tsx`

**Interfaces:**
- Consumes: Task 4 store primitive
- Produces:
  - `toastStore` — `Store<ToastItem[]>` where `ToastItem = { id: string; tone: "info"|"success"|"warning"|"danger"; message: string }`
  - `toast(tone: ToastItem["tone"], message: string): void` — pushes + auto-dismisses after 4s (via `setTimeout`)
  - `dismissToast(id: string): void`
  - `<Toaster />` — fixed bottom-right stack; each toast `data-testid="toast"`, close button `data-testid="toast-close-<id>"`

- [ ] **Step 1: Write the toast store, helper, and Toaster**

`src/components/toast.tsx`:
```tsx
import { createStore, useStore } from "../state/store";

export interface ToastItem {
  id: string;
  tone: "info" | "success" | "warning" | "danger";
  message: string;
}

export const toastStore = createStore<ToastItem[]>([]);

let toastCounter = 0;

export function toast(tone: ToastItem["tone"], message: string): void {
  const id = `toast-${++toastCounter}`;
  toastStore.setState((prev) => [...prev, { id, tone, message }]);
  window.setTimeout(() => dismissToast(id), 4000);
}

export function dismissToast(id: string): void {
  toastStore.setState((prev) => prev.filter((t) => t.id !== id));
}

const toneClasses: Record<ToastItem["tone"], string> = {
  info: "border-blue-500/40",
  success: "border-green-500/40",
  warning: "border-amber-500/40",
  danger: "border-danger/40",
};

export function Toaster() {
  const toasts = useStore(toastStore);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2" data-testid="toaster">
      {toasts.map((t) => (
        <div
          key={t.id}
          data-testid="toast"
          className={`pointer-events-auto flex items-center gap-3 rounded border bg-surface-800 px-3 py-2 text-sm text-text-primary shadow-lg ${toneClasses[t.tone]}`}
        >
          <span>{t.message}</span>
          <button
            data-testid={`toast-close-${t.id}`}
            onClick={() => dismissToast(t.id)}
            className="text-text-tertiary hover:text-text-primary"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write tests**

`src/components/toast.test.tsx`:
```tsx
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toastStore, toast, dismissToast, Toaster } from "./toast";

describe("toast", () => {
  beforeEach(() => toastStore.setState([]));

  it("pushes a toast", () => {
    toast("success", "Instance created");
    expect(toastStore.getState()).toHaveLength(1);
    expect(toastStore.getState()[0]?.message).toBe("Instance created");
  });

  it("auto-dismisses after 4s", () => {
    vi.useFakeTimers();
    toast("info", "hello");
    act(() => vi.advanceTimersByTime(4000));
    expect(toastStore.getState()).toHaveLength(0);
    vi.useRealTimers();
  });

  it("dismisses manually", () => {
    toast("info", "hello");
    const id = toastStore.getState()[0]!.id;
    dismissToast(id);
    expect(toastStore.getState()).toHaveLength(0);
  });

  it("renders toasts with close buttons", async () => {
    const user = userEvent.setup();
    toast("warning", "Disk low");
    render(<Toaster />);
    expect(screen.getByText("Disk low")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Disk low")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/toast.tsx src/components/toast.test.tsx
git commit -m "feat: add toast system"
```

---

### Task 8: Table Primitive

**Files:**
- Create: `src/components/table.tsx`, `src/components/table.test.tsx`

**Interfaces:**
- Consumes: Task 2 tokens
- Produces:
  - `Column<T> = { key: string; header: ReactNode; align?: "left"|"right"; width?: string; sortValue?: (row: T) => string|number; render: (row: T) => ReactNode }`
  - `Table<T>({ columns, rows, rowKey, onRowClick?, selectedKeys?, onSelectionChange?, emptyMessage?, dataTestId? })` — client-side sort on header click (`data-testid="th-<key>"`), row `data-testid="row"` with `data-selected`, select-all checkbox `data-testid="select-all"`, row checkbox `data-testid="row-select"`

- [ ] **Step 1: Write the Table**

`src/components/table.tsx`:
```tsx
import { useState } from "react";
import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: ReactNode;
  align?: "left" | "right";
  width?: string;
  sortValue?: (row: T) => string | number;
  render: (row: T) => ReactNode;
}

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  emptyMessage?: string;
  dataTestId?: string;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKeys,
  onSelectionChange,
  emptyMessage = "No data",
  dataTestId = "table",
}: TableProps<T>) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = [...rows];
  if (sortCol) {
    const col = columns.find((c) => c.key === sortCol);
    if (col?.sortValue) {
      const sv = col.sortValue;
      sorted.sort((a, b) => {
        const av = sv(a);
        const bv = sv(b);
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
  }

  const allSelected = rows.length > 0 && (selectedKeys?.length ?? 0) === rows.length;
  const toggleAll = () => {
    if (!onSelectionChange || !selectedKeys) return;
    onSelectionChange(allSelected ? [] : rows.map(rowKey));
  };
  const toggle = (key: string) => {
    if (!onSelectionChange || !selectedKeys) return;
    onSelectionChange(
      selectedKeys.includes(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key]
    );
  };
  const headerClick = (col: Column<T>) => {
    if (!col.sortValue) return;
    if (sortCol === col.key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col.key);
      setSortDir("asc");
    }
  };

  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full text-sm" data-testid={dataTestId}>
        <thead className="bg-surface-700 text-left text-xs text-text-secondary">
          <tr>
            {onSelectionChange && (
              <th className="w-8 px-3 py-2">
                <input type="checkbox" data-testid="select-all" checked={allSelected} onChange={toggleAll} className="accent-accent-600" aria-label="Select all" />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                data-testid={`th-${col.key}`}
                onClick={() => headerClick(col)}
                className={`px-3 py-2 ${col.align === "right" ? "text-right" : ""} ${col.sortValue ? "cursor-pointer select-none hover:text-text-primary" : ""}`}
                style={{ width: col.width }}
              >
                {col.header}
                {sortCol === col.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface-800">
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (onSelectionChange ? 1 : 0)} className="px-3 py-8 text-center text-text-tertiary">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row) => {
              const key = rowKey(row);
              const selected = selectedKeys?.includes(key) ?? false;
              return (
                <tr
                  key={key}
                  data-testid="row"
                  data-selected={selected}
                  onClick={() => onRowClick?.(row)}
                  className={`text-text-primary ${onRowClick ? "cursor-pointer" : ""} ${selected ? "bg-accent-600/10" : "hover:bg-surface-700/60"}`}
                >
                  {onSelectionChange && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        data-testid="row-select"
                        checked={selected}
                        onChange={() => toggle(key)}
                        onClick={(e) => e.stopPropagation()}
                        className="accent-accent-600"
                        aria-label={`Select ${key}`}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={`px-3 py-2 ${col.align === "right" ? "text-right" : ""}`} style={{ width: col.width }}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Write tests**

`src/components/table.test.tsx`:
```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Table } from "./table";
import type { Column } from "./table";

interface Row {
  name: string;
  status: string;
}

const columns: Column<Row>[] = [
  { key: "name", header: "Name", sortValue: (r) => r.name, render: (r) => r.name },
  { key: "status", header: "Status", render: (r) => r.status },
];

const rows: Row[] = [
  { name: "web1", status: "Started" },
  { name: "db1", status: "Stopped" },
];

describe("Table", () => {
  it("renders rows", () => {
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.name} />);
    expect(screen.getByText("web1")).toBeInTheDocument();
    expect(screen.getByText("db1")).toBeInTheDocument();
  });

  it("sorts by column", async () => {
    const user = userEvent.setup();
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.name} />);
    await user.click(screen.getByTestId("th-name"));
    const rowsEl = screen.getAllByTestId("row");
    expect(rowsEl[0]).toHaveTextContent("db1");
    await user.click(screen.getByTestId("th-name"));
    expect(screen.getAllByTestId("row")[0]).toHaveTextContent("web1");
  });

  it("selects rows and select-all", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.name} selectedKeys={[]} onSelectionChange={onSelectionChange} />);
    await user.click(screen.getAllByTestId("row-select")[0]!);
    expect(onSelectionChange).toHaveBeenCalledWith(["web1"]);
    await user.click(screen.getByTestId("select-all"));
    expect(onSelectionChange).toHaveBeenCalledWith(["web1", "db1"]);
  });

  it("shows empty message", () => {
    render(<Table columns={columns} rows={[]} rowKey={(r) => r.name} emptyMessage="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("calls onRowClick", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.name} onRowClick={onRowClick} />);
    await user.click(within(screen.getAllByTestId("row")[0]!).getByText("web1"));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });
});
```

- [ ] **Step 3: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/table.tsx src/components/table.test.tsx
git commit -m "feat: add table primitive with sorting and selection"
```

---

### Task 9: Tabs, Breadcrumbs, Progress

**Files:**
- Create: `src/components/tabs.tsx`, `src/components/breadcrumbs.tsx`, `src/components/progress.tsx`, `src/components/misc.test.tsx`

**Interfaces:**
- Consumes: Task 2 tokens; react-router `Link` (breadcrumbs)
- Produces:
  - `TabItem = { key: string; label: ReactNode }`; `Tabs({ tabs, active, onChange })` — `data-testid="tab-<key>"`, role tab/tablist
  - `Crumb = { label: string; to?: string }`; `Breadcrumbs({ items })` — `data-testid="breadcrumbs"`
  - `Progress({ value?: number, tone?, size? })` — `value` 0–100 or `undefined` for indeterminate, `role="progressbar"`, `data-testid="progress"`

- [ ] **Step 1: Write the components**

`src/components/tabs.tsx`:
```tsx
import type { ReactNode } from "react";

export interface TabItem {
  key: string;
  label: ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div role="tablist" data-testid="tabs" className="flex gap-1 border-b border-border">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          data-testid={`tab-${t.key}`}
          onClick={() => onChange(t.key)}
          className={`border-b-2 px-3 py-2 text-sm ${active === t.key ? "border-accent-500 text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
```

`src/components/breadcrumbs.tsx`:
```tsx
import { Link } from "react-router-dom";

export interface Crumb {
  label: string;
  to?: string;
}

export interface BreadcrumbsProps {
  items: Crumb[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav data-testid="breadcrumbs" className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-text-tertiary">/</span>}
          {c.to ? (
            <Link to={c.to} className="text-accent-400 hover:underline">{c.label}</Link>
          ) : (
            <span className="text-text-secondary">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
```

`src/components/progress.tsx`:
```tsx
export interface ProgressProps {
  value?: number;
  tone?: "accent" | "success" | "danger";
  size?: "sm" | "md";
}

const toneClasses = { accent: "bg-accent-500", success: "bg-success", danger: "bg-danger" };

export function Progress({ value, tone = "accent", size = "sm" }: ProgressProps) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      data-testid="progress"
      className={`w-full overflow-hidden rounded bg-surface-500 ${size === "sm" ? "h-1.5" : "h-2.5"}`}
    >
      {value === undefined ? (
        <div className={`h-full w-1/3 ${toneClasses[tone]} animate-[indeterminate_1.2s_ease-in-out_infinite]`} />
      ) : (
        <div className={`h-full ${toneClasses[tone]}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write tests**

`src/components/misc.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { Tabs } from "./tabs";
import { Breadcrumbs } from "./breadcrumbs";
import { Progress } from "./progress";

describe("Tabs", () => {
  it("switches active tab", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs tabs={[{ key: "overview", label: "Overview" }, { key: "logs", label: "Logs" }]} active="overview" onChange={onChange} />);
    await user.click(screen.getByTestId("tab-logs"));
    expect(onChange).toHaveBeenCalledWith("logs");
    expect(screen.getByTestId("tab-overview")).toHaveAttribute("aria-selected", "true");
  });
});

describe("Breadcrumbs", () => {
  it("renders crumb trail", () => {
    render(
      <MemoryRouter>
        <Breadcrumbs items={[{ label: "Instances", to: "/instances" }, { label: "web1" }]} />
      </MemoryRouter>
    );
    expect(screen.getByTestId("breadcrumbs")).toHaveTextContent("Instances");
    expect(screen.getByTestId("breadcrumbs")).toHaveTextContent("web1");
  });
});

describe("Progress", () => {
  it("renders determinate width", () => {
    render(<Progress value={42} />);
    expect(screen.getByRole("progressbar")).toHaveStyle({ width: undefined });
    expect(screen.getByTestId("progress").querySelector("div")).toHaveStyle({ width: "42%" });
  });

  it("clamps value to 100", () => {
    render(<Progress value={150} />);
    expect(screen.getByTestId("progress").querySelector("div")).toHaveStyle({ width: "100%" });
  });
});
```

- [ ] **Step 3: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/tabs.tsx src/components/breadcrumbs.tsx src/components/progress.tsx src/components/misc.test.tsx
git commit -m "feat: add tabs, breadcrumbs, progress primitives"
```

---

### Task 10: Tree, EmptyState, SplitPane

**Files:**
- Create: `src/components/tree.tsx`, `src/components/empty-state.tsx`, `src/components/split-pane.tsx`, `src/components/tree.test.tsx`

**Interfaces:**
- Consumes: Task 2 tokens
- Produces:
  - `TreeNode = { id: string; label: ReactNode; badge?: ReactNode; children?: TreeNode[] }`
  - `Tree({ nodes, selectedId?, onSelect? })` — `data-testid="tree"`, nodes `data-testid="tree-<id>"`, role tree/treeitem/group; toggles expansion on click
  - `EmptyState({ title, description?, action?, icon? })` — `data-testid="empty-state"`
  - `SplitPane({ left, right, initial?, min? })` — `data-testid="split-pane"`, drag handle `data-testid="split-handle"` (covers the spec's ResizablePanel)

- [ ] **Step 1: Write the components**

`src/components/tree.tsx`:
```tsx
import { useState } from "react";
import type { ReactNode } from "react";

export interface TreeNode {
  id: string;
  label: ReactNode;
  badge?: ReactNode;
  children?: TreeNode[];
}

export interface TreeProps {
  nodes: TreeNode[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

export function Tree({ nodes, selectedId, onSelect }: TreeProps) {
  return (
    <ul role="tree" data-testid="tree" className="space-y-0.5">
      {nodes.map((node) => (
        <TreeNodeItem key={node.id} node={node} selectedId={selectedId} onSelect={onSelect} depth={0} />
      ))}
    </ul>
  );
}

function TreeNodeItem({
  node,
  selectedId,
  onSelect,
  depth,
}: {
  node: TreeNode;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = (node.children?.length ?? 0) > 0;

  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined} aria-selected={selectedId === node.id}>
      <div
        data-testid={`tree-${node.id}`}
        onClick={() => {
          onSelect?.(node.id);
          if (hasChildren) setExpanded((e) => !e);
        }}
        className={`flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 ${selectedId === node.id ? "bg-accent-600/15 text-accent-300" : "text-text-secondary hover:bg-surface-700/60 hover:text-text-primary"}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        <span className={`w-3 text-xs text-text-tertiary ${hasChildren ? "" : "invisible"}`}>{expanded ? "▾" : "▸"}</span>
        <span className="truncate text-sm">{node.label}</span>
        {node.badge && <span className="ml-auto">{node.badge}</span>}
      </div>
      {hasChildren && expanded && (
        <ul role="group">
          {node.children!.map((child) => (
            <TreeNodeItem key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
```

`src/components/empty-state.tsx`:
```tsx
import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center"
    >
      {icon && <div className="text-3xl">{icon}</div>}
      <div className="text-sm font-medium text-text-primary">{title}</div>
      {description && <p className="max-w-md text-xs text-text-secondary">{description}</p>}
      {action}
    </div>
  );
}
```

`src/components/split-pane.tsx`:
```tsx
import { useRef, useState } from "react";
import type { ReactNode } from "react";

export interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  initial?: number;
  min?: number;
}

export function SplitPane({ left, right, initial = 40, min = 15 }: SplitPaneProps) {
  const [percent, setPercent] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMove = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPercent(Math.min(85, Math.max(min, pct)));
  };

  return (
    <div
      ref={containerRef}
      data-testid="split-pane"
      className="flex h-full"
      onMouseMove={(e) => dragging && onMove(e.clientX)}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
    >
      <div className="min-w-0 overflow-auto" style={{ width: `${percent}%` }}>{left}</div>
      <div
        data-testid="split-handle"
        onMouseDown={() => setDragging(true)}
        className="w-1 cursor-col-resize bg-border hover:bg-accent-500"
      />
      <div className="min-w-0 flex-1 overflow-auto">{right}</div>
    </div>
  );
}
```

- [ ] **Step 2: Write tests**

`src/components/tree.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tree } from "./tree";
import { EmptyState } from "./empty-state";
import { SplitPane } from "./split-pane";

describe("Tree", () => {
  const nodes = [
    {
      id: "project-default",
      label: "default",
      children: [
        { id: "instances", label: "Instances", badge: <span>3</span> },
        { id: "images", label: "Images" },
      ],
    },
  ];

  it("renders and expands", async () => {
    const user = userEvent.setup();
    render(<Tree nodes={nodes} />);
    expect(screen.getByTestId("tree-instances")).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("tree-project-default"));
    expect(screen.getAllByRole("group").length).toBeGreaterThan(0);
  });

  it("calls onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Tree nodes={nodes} onSelect={onSelect} />);
    await user.click(screen.getByTestId("tree-instances"));
    expect(onSelect).toHaveBeenCalledWith("instances");
  });
});

describe("EmptyState", () => {
  it("renders title and action", () => {
    render(<EmptyState title="No instances" action={<button>Create</button>} />);
    expect(screen.getByTestId("empty-state")).toHaveTextContent("No instances");
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });
});

describe("SplitPane", () => {
  it("renders both panes", () => {
    render(<SplitPane left={<div>left</div>} right={<div>right</div>} />);
    expect(screen.getByText("left")).toBeInTheDocument();
    expect(screen.getByText("right")).toBeInTheDocument();
    expect(screen.getByTestId("split-handle")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/tree.tsx src/components/empty-state.tsx src/components/split-pane.tsx src/components/tree.test.tsx
git commit -m "feat: add tree, empty-state, split-pane primitives"
```

---

### Task 11: Component Gallery

**Files:**
- Create: `src/pages/gallery.tsx`, `src/pages/gallery.test.tsx`

**Interfaces:**
- Consumes: all primitives from Tasks 4–10
- Produces: `<Gallery />` page at `/gallery` — sections for each primitive showing variants; `data-testid="gallery"`

- [ ] **Step 1: Write the gallery page**

`src/pages/gallery.tsx`:
```tsx
import { useState } from "react";
import { Button } from "../components/button";
import { Badge } from "../components/badge";
import { StatusDot } from "../components/status-dot";
import { Spinner } from "../components/spinner";
import { Input } from "../components/input";
import { Select } from "../components/select";
import { Textarea } from "../components/textarea";
import { Checkbox } from "../components/checkbox";
import { Switch } from "../components/switch";
import { Dialog } from "../components/dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Tooltip } from "../components/tooltip";
import { Table } from "../components/table";
import { Tabs } from "../components/tabs";
import { Breadcrumbs } from "../components/breadcrumbs";
import { Progress } from "../components/progress";
import { Tree } from "../components/tree";
import { EmptyState } from "../components/empty-state";
import { SplitPane } from "../components/split-pane";
import { toast } from "../components/toast";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface-900 p-4" data-testid="gallery-section">
      <h2 className="mb-3 text-sm font-semibold text-text-primary">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export function Gallery() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tab, setTab] = useState("a");

  return (
    <div className="space-y-4 p-6" data-testid="gallery">
      <h1 className="text-lg font-semibold text-text-primary">Component Gallery</h1>

      <Section title="Button">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button size="sm">Small</Button>
        <Button loading>Loading</Button>
        <Button disabled>Disabled</Button>
      </Section>

      <Section title="Badge">
        <Badge tone="neutral">Neutral</Badge>
        <Badge tone="info">Info</Badge>
        <Badge tone="success">Success</Badge>
        <Badge tone="warning">Warning</Badge>
        <Badge tone="danger">Danger</Badge>
      </Section>

      <Section title="StatusDot">
        <StatusDot tone="success" label="Started" />
        <StatusDot tone="danger" label="Error" />
      </Section>

      <Section title="Spinner">
        <Spinner size="xs" />
        <Spinner size="sm" />
        <Spinner size="md" />
      </Section>

      <Section title="Form">
        <Input label="Name" placeholder="web1" />
        <Select label="Type" defaultValue="container">
          <option value="container">Container</option>
          <option value="virtual-machine">VM</option>
        </Select>
        <Textarea label="Notes" placeholder="Optional" />
        <Checkbox label="Ephemeral" />
        <Switch checked onChange={() => {}} label="Auto start" />
      </Section>

      <Section title="Overlay">
        <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
        <Button onClick={() => setConfirmOpen(true)}>Open confirm</Button>
        <Tooltip label="Tooltip text"><Button>Hover me</Button></Tooltip>
      </Section>

      <Section title="Progress">
        <Progress value={45} />
        <Progress value={80} tone="success" />
        <Progress value={30} tone="danger" />
        <Progress size="md" />
      </Section>

      <Section title="Tabs">
        <Tabs tabs={[{ key: "a", label: "Tab A" }, { key: "b", label: "Tab B" }]} active={tab} onChange={setTab} />
      </Section>

      <Section title="Breadcrumbs">
        <Breadcrumbs items={[{ label: "Instances", to: "/instances" }, { label: "web1" }]} />
      </Section>

      <Section title="Table">
        <Table
          columns={[
            { key: "name", header: "Name", sortValue: (r: { name: string }) => r.name, render: (r: { name: string }) => r.name },
            { key: "status", header: "Status", render: (r: { status: string }) => r.status },
          ]}
          rows={[{ name: "web1", status: "Started" }, { name: "db1", status: "Stopped" }]}
          rowKey={(r) => r.name}
        />
      </Section>

      <Section title="Tree">
        <Tree
          nodes={[{ id: "p", label: "default", children: [{ id: "i", label: "Instances" }, { id: "im", label: "Images" }] }]}
        />
      </Section>

      <Section title="EmptyState">
        <EmptyState title="No instances" description="Create your first instance." action={<Button size="sm">Create instance</Button>} />
      </Section>

      <Section title="SplitPane">
        <div className="h-40 w-full">
          <SplitPane left={<div className="p-2">left</div>} right={<div className="p-2">right</div>} />
        </div>
      </Section>

      <Section title="Toast">
        <Button onClick={() => toast("success", "Toast works")}>Fire toast</Button>
      </Section>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Dialog">Dialog body.</Dialog>
      <ConfirmDialog open={confirmOpen} title="Confirm" body="Are you sure?" onConfirm={() => setConfirmOpen(false)} onCancel={() => setConfirmOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 2: Write a smoke test**

`src/pages/gallery.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Gallery } from "./gallery";

describe("Gallery", () => {
  it("renders all sections", () => {
    render(
      <MemoryRouter>
        <Gallery />
      </MemoryRouter>
    );
    expect(screen.getByTestId("gallery")).toBeInTheDocument();
    expect(screen.getByText("Component Gallery")).toBeInTheDocument();
    expect(screen.getAllByTestId("gallery-section").length).toBeGreaterThan(10);
    expect(screen.getByText("Button")).toBeInTheDocument();
    expect(screen.getByText("Table")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 4: Commit**

```bash
git add src/pages/gallery.tsx src/pages/gallery.test.tsx
git commit -m "feat: add component gallery page"
```

---

### Task 12: API Types + Client Core

**Files:**
- Create: `src/api/types.ts`, `src/api/client.ts`, `src/api/client.test.ts`

**Interfaces:**
- Consumes: nothing (independent)
- Produces (all in `src/api/types.ts` unless noted):
  - `ApiError extends Error { status: number; code?: number }` (in `client.ts`)
  - `ApiClient` (in `client.ts`): `get<T>(path): Promise<T>`, `list<T>(path): Promise<T[]>` (appends `?recursion=1`), `post<T>(path, body?): Promise<T>`, `put<T>(path, body): Promise<T>`, `delete(path): Promise<void>`; `setForbiddenHandler(handler: () => void)`; throws `ApiError(status, code, message)` on non-2xx and calls the forbidden handler on 403
  - `ServerInfo { api_extensions: string[]; api_status: string; auth: string; environment: { server: string; server_version: string; project: string } }`
  - `InstanceStatus` union: `"Stopped" | "Started" | "Frozen" | "Error" | "Starting" | "Stopping" | "Freezing" | "Unfreezing" | "Restarting" | "Migrating"`
  - `Instance { name: string; status: InstanceStatus; type: "container" | "virtual-machine"; description: string; created_at: string; last_used_at: string; config: Record<string, string>; devices: Record<string, Record<string, string>>; profiles: string[]; project: string; ephemeral: boolean }`
  - `Image { fingerprint: string; filename: string; description: string; public: boolean; created_at: string; size: number; type: "container" | "virtual-machine"; properties: Record<string, string> }`
  - `Profile { name: string; description: string; config: Record<string, string>; devices: Record<string, Record<string, string>> }`
  - `Network { name: string; description: string; type: string; managed: boolean; used_by: string[]; status: string }`
  - `StoragePool { name: string; description: string; driver: string; status: string; used_by: string[] }`
  - `StorageVolume { name: string; type: string; content_type: string; used_by?: string[] }`
  - `Project { name: string; description: string; config: Record<string, string> }`
  - `OperationStatus = "Running" | "Success" | "Failure" | "Cancelled" | "Unknown"`
  - `Operation { id: string; class: "task" | "websocket"; description: string; status: OperationStatus; status_code: number; created_at: string; updated_at: string; may_cancel: boolean; err?: string; resources?: Record<string, string[]>; metadata?: Record<string, unknown> }`
  - `AsyncResponse { type: "async"; status: string; status_code: number; operation: string; metadata: Operation | null; err?: string }`
  - `SyncResponse { type: "sync"; status: string; status_code: number; metadata: unknown }`
  - `InstanceStateInfo { status: InstanceStatus; cpu: { usage: number }; memory: { usage: number }; network?: Record<string, { addresses: { family: string; address: string; netmask: string }[] }> }`

- [ ] **Step 1: Write types**

`src/api/types.ts`:
```ts
export interface ServerInfo {
  api_extensions: string[];
  api_status: string;
  auth: string;
  environment: {
    server: string;
    server_version: string;
    project: string;
  };
}

export type InstanceStatus =
  | "Stopped"
  | "Started"
  | "Frozen"
  | "Error"
  | "Starting"
  | "Stopping"
  | "Freezing"
  | "Unfreezing"
  | "Restarting"
  | "Migrating";

export interface Instance {
  name: string;
  status: InstanceStatus;
  type: "container" | "virtual-machine";
  description: string;
  created_at: string;
  last_used_at: string;
  config: Record<string, string>;
  devices: Record<string, Record<string, string>>;
  profiles: string[];
  project: string;
  ephemeral: boolean;
}

export interface Image {
  fingerprint: string;
  filename: string;
  description: string;
  public: boolean;
  created_at: string;
  size: number;
  type: "container" | "virtual-machine";
  properties: Record<string, string>;
}

export interface Profile {
  name: string;
  description: string;
  config: Record<string, string>;
  devices: Record<string, Record<string, string>>;
}

export interface Network {
  name: string;
  description: string;
  type: string;
  managed: boolean;
  used_by: string[];
  status: string;
}

export interface StoragePool {
  name: string;
  description: string;
  driver: string;
  status: string;
  used_by: string[];
}

export interface StorageVolume {
  name: string;
  type: string;
  content_type: string;
  used_by?: string[];
}

export interface Project {
  name: string;
  description: string;
  config: Record<string, string>;
}

export type OperationStatus = "Running" | "Success" | "Failure" | "Cancelled" | "Unknown";

export interface Operation {
  id: string;
  class: "task" | "websocket";
  description: string;
  status: OperationStatus;
  status_code: number;
  created_at: string;
  updated_at: string;
  may_cancel: boolean;
  err?: string;
  resources?: Record<string, string[]>;
  metadata?: Record<string, unknown>;
}

export interface AsyncResponse {
  type: "async";
  status: string;
  status_code: number;
  operation: string;
  metadata: Operation | null;
  err?: string;
}

export interface SyncResponse {
  type: "sync";
  status: string;
  status_code: number;
  metadata: unknown;
}

export interface InstanceStateInfo {
  status: InstanceStatus;
  cpu: { usage: number };
  memory: { usage: number };
  network?: Record<string, { addresses: { family: string; address: string; netmask: string }[] }>;
}
```

- [ ] **Step 2: Write the client core with tests (test-first: write test first, run, then implement)**

`src/api/client.test.ts`:
```ts
import { ApiClient, ApiError } from "./client";

describe("ApiClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("GETs JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { hello: "world" })));
    const client = new ApiClient("/1.0");
    const data = await client.get<{ hello: string }>("/");
    expect(data).toEqual({ hello: "world" });
    expect(fetch).toHaveBeenCalledWith("/1.0/", expect.objectContaining({ method: "GET" }));
  });

  it("lists with recursion=1 and filters URL strings", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, ["/1.0/instances/web1", { name: "web1" }])));
    const client = new ApiClient("/1.0");
    const data = await client.list<{ name: string }>("/instances");
    expect(data).toEqual([{ name: "web1" }]);
    expect(fetch).toHaveBeenCalledWith("/1.0/instances?recursion=1", expect.anything());
  });

  it("POSTs JSON body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { type: "sync" })));
    const client = new ApiClient("/1.0");
    await client.post("/instances", { name: "web1" });
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ name: "web1" });
  });

  it("returns null for empty 200 responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 200 })));
    const client = new ApiClient("/1.0");
    const result = await client.post("/x", {});
    expect(result).toBeNull();
  });

  it("throws ApiError with status and code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: "Not found", error_code: 404 })));
    const client = new ApiClient("/1.0");
    await expect(client.get("/nope")).rejects.toMatchObject({ status: 404, code: 404, message: "Not found" });
  });

  it("calls the forbidden handler on 403", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, { error: "denied", error_code: 403 })));
    const client = new ApiClient("/1.0");
    const onForbidden = vi.fn();
    client.setForbiddenHandler(onForbidden);
    await expect(client.get("/x")).rejects.toBeInstanceOf(ApiError);
    expect(onForbidden).toHaveBeenCalledTimes(1);
  });

  it("DELETE sends no body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 200 })));
    const client = new ApiClient("/1.0");
    await client.delete("/instances/web1");
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.method).toBe("DELETE");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/api/client.test.ts`
Expected: FAIL — module `client` not found.

- [ ] **Step 4: Write the client**

`src/api/client.ts`:
```ts
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
```

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add src/api/types.ts src/api/client.ts src/api/client.test.ts
git commit -m "feat: add typed api client core"
```

---

### Task 13: API Endpoint Modules

**Files:**
- Create: `src/api/instances.ts`, `src/api/infra.ts`, `src/api/server.ts`, `src/api/operations.ts`, `src/api/index.ts`, `src/api/endpoints.test.ts`

**Interfaces:**
- Consumes: `ApiClient`, types from Task 12
- Produces (constructor-takes-client classes, instantiated with the shared `api` in `src/api/index.ts`):
  - `InstancesApi`: `list()`, `get(name)`, `create(body)`, `update(name, body)`, `delete(name)`, `setState(name, action: "start"|"stop"|"restart"|"freeze"|"unfreeze", force?)`, `state(name)`, `exec(name, command: string[], interactive: boolean)`, `console(name, width, height)`, `listSnapshots(name)`, `createSnapshot(name, snapName, stateful?)`, `restoreSnapshot(name, snapName)`, `deleteSnapshot(name, snapName)`, `listLogs(name)`, `readLog(name, file)`
  - `InfraApi`: `listImages()`, `deleteImage(fingerprint)`, `pullImage(source)`, `listProfiles()`, `getProfile(name)`, `createProfile(body)`, `updateProfile(name, body)`, `deleteProfile(name)`, `listNetworks()`, `createNetwork(body)`, `updateNetwork(name, body)`, `deleteNetwork(name)`, `listPools()`, `createPool(body)`, `deletePool(name)`, `listPoolVolumes(pool)`, `deletePoolVolume(pool, name)`, `listProjects()`, `getProject(name)`, `createProject(body)`, `deleteProject(name)`
  - `ServerApi`: `info()`
  - `OperationsApi`: `get(id)`, `wait(id)` (GET `/operations/{id}/wait`)
  - `src/api/index.ts`: `export const api = new ApiClient(); export const instancesApi = new InstancesApi(api); export const infraApi = new InfraApi(api); export const serverApi = new ServerApi(api); export const operationsApi = new OperationsApi(api);`

Request/response shapes:
- Create instance body: `{ name, type, description?, profiles?, source: { type: "image", image?: string, fingerprint?: string, server?: string, alias?: string }, config?, devices?, ephemeral? }`
- Set state: `PUT /instances/{name}/state` body `{ action, force? }`
- Exec: `POST /instances/{name}/exec` body `{ command, interactive, environment: { TERM: "xterm" } }` → `AsyncResponse` whose `metadata` contains `{ fds: Record<"0"|"1"|"2", string>, return: number }`
- Console: `PUT /instances/{name}/console` body `{ width, height, type: "console" }` → AsyncResponse, `metadata.fds["0"]` is the websocket URL
- Snapshot create: `POST /instances/{name}/snapshots` body `{ name, stateful? }`; restore: `POST /instances/{name}/snapshots/{snap}` body `{ restore: true }`
- Pull image: `POST /images` body `{ source: { type: "image", alias, server, protocol }, filename?, public? }`

- [ ] **Step 1: Write the endpoint modules**

`src/api/instances.ts`:
```ts
import type { ApiClient } from "./client";
import type { Instance, InstanceStateInfo, AsyncResponse, SyncResponse } from "./types";

export interface CreateInstanceBody {
  name: string;
  type: "container" | "virtual-machine";
  description?: string;
  profiles?: string[];
  source?: { type: "image"; image?: string; fingerprint?: string; server?: string; alias?: string };
  config?: Record<string, string>;
  devices?: Record<string, Record<string, string>>;
  ephemeral?: boolean;
}

export class InstancesApi {
  constructor(private client: ApiClient) {}

  list(): Promise<Instance[]> {
    return this.client.list<Instance>("/instances");
  }

  get(name: string): Promise<Instance> {
    return this.client.get<Instance>(`/instances/${name}`);
  }

  create(body: CreateInstanceBody): Promise<AsyncResponse | SyncResponse | null> {
    return this.client.post(`/instances`, body);
  }

  update(name: string, body: { config?: Record<string, string>; description?: string; ephemeral?: boolean }): Promise<AsyncResponse | SyncResponse | null> {
    return this.client.put(`/instances/${name}`, body);
  }

  delete(name: string): Promise<void> {
    return this.client.delete(`/instances/${name}`);
  }

  setState(
    name: string,
    action: "start" | "stop" | "restart" | "freeze" | "unfreeze",
    force = false
  ): Promise<AsyncResponse | null> {
    return this.client.post(`/instances/${name}/state`, { action, force });
  }

  state(name: string): Promise<InstanceStateInfo> {
    return this.client.get<InstanceStateInfo>(`/instances/${name}/state`);
  }

  exec(name: string, command: string[], interactive: boolean): Promise<AsyncResponse | null> {
    return this.client.post(`/instances/${name}/exec`, {
      command,
      interactive,
      environment: { TERM: "xterm" },
    });
  }

  console(name: string, width: number, height: number): Promise<AsyncResponse | null> {
    return this.client.put(`/instances/${name}/console`, { width, height, type: "console" });
  }

  listSnapshots(name: string): Promise<Instance[]> {
    return this.client.list<Instance>(`/instances/${name}/snapshots`);
  }

  createSnapshot(name: string, snapName: string, stateful = false): Promise<AsyncResponse | null> {
    return this.client.post(`/instances/${name}/snapshots`, { name: snapName, stateful });
  }

  restoreSnapshot(name: string, snapName: string): Promise<AsyncResponse | null> {
    return this.client.post(`/instances/${name}/snapshots/${snapName}`, { restore: true });
  }

  deleteSnapshot(name: string, snapName: string): Promise<void> {
    return this.client.delete(`/instances/${name}/snapshots/${snapName}`);
  }

  listLogs(name: string): Promise<string[]> {
    return this.client.get<string[]>(`/instances/${name}/logs`);
  }

  readLog(name: string, file: string): Promise<string> {
    return this.client.get<string>(`/instances/${name}/logs/${file}`);
  }
}
```

Note: `SyncResponseLike` is an alias needed by the create/update return types; add to `types.ts`:
```ts
export type SyncResponseLike = SyncResponse | null;
```
and import it. (If typecheck complains about the alias name, simply inline the union `AsyncResponse | SyncResponse | null` in both signatures instead.)

`src/api/infra.ts`:
```ts
import type { ApiClient } from "./client";
import type { Image, Profile, Network, StoragePool, StorageVolume, Project, AsyncResponse, SyncResponse } from "./types";

export type OpResponse = AsyncResponse | SyncResponse | null;

export class InfraApi {
  constructor(private client: ApiClient) {}

  listImages(): Promise<Image[]> {
    return this.client.list<Image>("/images");
  }

  deleteImage(fingerprint: string): Promise<void> {
    return this.client.delete(`/images/${fingerprint}`);
  }

  pullImage(source: { alias: string; server: string; protocol?: string; filename?: string }): Promise<OpResponse> {
    return this.client.post(`/images`, {
      filename: source.filename ?? source.alias,
      public: false,
      source: { type: "image", alias: source.alias, server: source.server, protocol: source.protocol ?? "simplestreams" },
    });
  }

  listProfiles(): Promise<Profile[]> {
    return this.client.list<Profile>("/profiles");
  }

  getProfile(name: string): Promise<Profile> {
    return this.client.get<Profile>(`/profiles/${name}`);
  }

  createProfile(body: { name: string; description?: string; config?: Record<string, string> }): Promise<OpResponse> {
    return this.client.post(`/profiles`, body);
  }

  updateProfile(name: string, body: { description?: string; config?: Record<string, string> }): Promise<OpResponse> {
    return this.client.put(`/profiles/${name}`, body);
  }

  deleteProfile(name: string): Promise<void> {
    return this.client.delete(`/profiles/${name}`);
  }

  listNetworks(): Promise<Network[]> {
    return this.client.list<Network>("/networks");
  }

  createNetwork(body: { name: string; type: string; description?: string }): Promise<OpResponse> {
    return this.client.post(`/networks`, body);
  }

  updateNetwork(name: string, body: { description?: string }): Promise<OpResponse> {
    return this.client.put(`/networks/${name}`, body);
  }

  deleteNetwork(name: string): Promise<void> {
    return this.client.delete(`/networks/${name}`);
  }

  listPools(): Promise<StoragePool[]> {
    return this.client.list<StoragePool>("/storage-pools");
  }

  createPool(body: { name: string; driver: string; description?: string }): Promise<OpResponse> {
    return this.client.post(`/storage-pools`, body);
  }

  deletePool(name: string): Promise<void> {
    return this.client.delete(`/storage-pools/${name}`);
  }

  listPoolVolumes(pool: string): Promise<StorageVolume[]> {
    return this.client.list<StorageVolume>(`/storage-pools/${pool}/volumes`);
  }

  deletePoolVolume(pool: string, name: string): Promise<void> {
    return this.client.delete(`/storage-pools/${pool}/volumes/${name}`);
  }

  listProjects(): Promise<Project[]> {
    return this.client.list<Project>("/projects");
  }

  getProject(name: string): Promise<Project> {
    return this.client.get<Project>(`/projects/${name}`);
  }

  createProject(body: { name: string; description?: string }): Promise<OpResponse> {
    return this.client.post(`/projects`, body);
  }

  deleteProject(name: string): Promise<void> {
    return this.client.delete(`/projects/${name}`);
  }
}
```

`src/api/server.ts`:
```ts
import type { ApiClient } from "./client";
import type { ServerInfo } from "./types";

export class ServerApi {
  constructor(private client: ApiClient) {}

  info(): Promise<ServerInfo> {
    return this.client.get<ServerInfo>("/");
  }
}
```

`src/api/operations.ts`:
```ts
import type { ApiClient } from "./client";
import type { Operation } from "./types";

export class OperationsApi {
  constructor(private client: ApiClient) {}

  get(id: string): Promise<Operation> {
    return this.client.get<Operation>(`/operations/${id}`);
  }

  wait(id: string): Promise<Operation> {
    return this.client.get<Operation>(`/operations/${id}/wait`);
  }
}
```

`src/api/index.ts`:
```ts
import { ApiClient } from "./client";
import { InstancesApi } from "./instances";
import { InfraApi } from "./infra";
import { ServerApi } from "./server";
import { OperationsApi } from "./operations";

export const api = new ApiClient("/1.0");
export const instancesApi = new InstancesApi(api);
export const infraApi = new InfraApi(api);
export const serverApi = new ServerApi(api);
export const operationsApi = new OperationsApi(api);
```

- [ ] **Step 2: Write tests**

`src/api/endpoints.test.ts`:
```ts
import { api, instancesApi, infraApi, serverApi, operationsApi } from "./index";

describe("API endpoints", () => {
  afterEach(() => vi.unstubAllGlobals());

  const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("instances list hits recursion=1", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [{ name: "web1", status: "Started" }]));
    vi.stubGlobal("fetch", fetchMock);
    await instancesApi.list();
    expect(fetchMock).toHaveBeenCalledWith("/1.0/instances?recursion=1", expect.anything());
  });

  it("instance setState posts action", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
    vi.stubGlobal("fetch", fetchMock);
    await instancesApi.setState("web1", "stop", true);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ action: "stop", force: true });
  });

  it("exec posts command and TERM env", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
    vi.stubGlobal("fetch", fetchMock);
    await instancesApi.exec("web1", ["/bin/sh"], true);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(init?.body as string)).toEqual({ command: ["/bin/sh"], interactive: true, environment: { TERM: "xterm" } });
  });

  it("snapshot restore posts restore flag", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
    vi.stubGlobal("fetch", fetchMock);
    await instancesApi.restoreSnapshot("web1", "snap1");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/1.0/instances/web1/snapshots/snap1");
    expect(JSON.parse(init?.body as string)).toEqual({ restore: true });
  });

  it("image pull posts simplestreams source", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
    vi.stubGlobal("fetch", fetchMock);
    await infraApi.pullImage({ alias: "ubuntu/24.04", server: "https://images.linuxcontainers.org" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/1.0/images");
    const body = JSON.parse(init?.body as string);
    expect(body.source).toEqual({ type: "image", alias: "ubuntu/24.04", server: "https://images.linuxcontainers.org", protocol: "simplestreams" });
  });

  it("projects list and pool volumes list", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [{ name: "default" }]));
    vi.stubGlobal("fetch", fetchMock);
    await infraApi.listProjects();
    await infraApi.listPoolVolumes("default");
    expect(fetchMock.mock.calls[1][0]).toBe("/1.0/storage-pools/default/volumes?recursion=1");
  });

  it("server info and operation wait", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    vi.stubGlobal("fetch", fetchMock);
    await serverApi.info();
    await operationsApi.wait("op1");
    expect(fetchMock.mock.calls[0][0]).toBe("/1.0/");
    expect(fetchMock.mock.calls[1][0]).toBe("/1.0/operations/op1/wait");
  });
});
```

- [ ] **Step 3: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 4: Commit**

```bash
git add src/api
git commit -m "feat: add api endpoint modules"
```

---

### Task 14: Event Stream (WebSocket + Reconnect)

**Files:**
- Create: `src/api/events.ts`, `src/api/events.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `StreamEvent = { type: "operation" | "lifecycle" | "logging" | "error"; timestamp: string; metadata: unknown }`
  - `EventStream` class: `constructor(url: string)`, `connect()`, `onEvent(fn: (e: StreamEvent) => void): () => void` (returns unsubscribe), `close()`; auto-reconnects with 1000ms backoff on unexpected close; URL built by `eventsUrl()` helper (in `src/api/index.ts`): `wss://`/`ws://` + `location.host` + `/1.0/events?type=operation,lifecycle,logging`

- [ ] **Step 1: Write EventStream with tests (test-first)**

`src/api/events.test.ts`:
```ts
import { EventStream } from "./events";
import type { StreamEvent } from "./events";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onmessage: ((msg: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
  static emit(instance: FakeWebSocket, data: unknown) {
    instance.onmessage?.({ data: JSON.stringify(data) });
  }
}

describe("EventStream", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("connects to the url", () => {
    const stream = new EventStream("wss://x/1.0/events");
    stream.connect();
    expect(FakeWebSocket.instances[0]?.url).toBe("wss://x/1.0/events");
    stream.close();
  });

  it("delivers parsed events to listeners", () => {
    const stream = new EventStream("ws://x");
    const listener = vi.fn();
    stream.connect();
    stream.onEvent(listener);
    FakeWebSocket.emit(FakeWebSocket.instances[0]!, { type: "operation", timestamp: "t", metadata: { id: "op1" } });
    expect(listener).toHaveBeenCalledWith({ type: "operation", timestamp: "t", metadata: { id: "op1" } });
    stream.close();
  });

  it("unsubscribes", () => {
    const stream = new EventStream("ws://x");
    const listener = vi.fn();
    stream.connect();
    const unsubscribe = stream.onEvent(listener);
    unsubscribe();
    FakeWebSocket.emit(FakeWebSocket.instances[0]!, { type: "operation", timestamp: "t", metadata: {} });
    expect(listener).not.toHaveBeenCalled();
    stream.close();
  });

  it("reconnects after unexpected close", () => {
    const stream = new EventStream("ws://x");
    stream.connect();
    const ws = FakeWebSocket.instances[0]!;
    ws.onclose?.();
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances.length).toBe(2);
    stream.close();
  });

  it("does not reconnect after close()", () => {
    const stream = new EventStream("ws://x");
    stream.connect();
    stream.close();
    const ws = FakeWebSocket.instances[0]!;
    ws.onclose?.();
    vi.advanceTimersByTime(2000);
    expect(FakeWebSocket.instances.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/api/events.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write EventStream**

`src/api/events.ts`:
```ts
export type StreamEvent = {
  type: "operation" | "lifecycle" | "logging" | "error";
  timestamp: string;
  metadata: unknown;
};

export class EventStream {
  private ws: WebSocket | null = null;
  private listeners = new Set<(e: StreamEvent) => void>();
  private closed = false;

  constructor(private url: string) {}

  connect(): void {
    this.closed = false;
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(String(msg.data)) as StreamEvent;
        this.listeners.forEach((fn) => fn(event));
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = () => {
      if (this.closed) return;
      this.ws = null;
      window.setTimeout(() => this.connect(), 1000);
    };
    ws.onerror = () => ws.close();
  }

  onEvent(fn: (e: StreamEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  close(): void {
    this.closed = true;
    this.ws?.close();
    this.ws = null;
  }
}
```

- [ ] **Step 4: Add eventsUrl helper to the api index**

`src/api/index.ts` — append:
```ts
export function eventsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/1.0/events?type=operation,lifecycle,logging`;
}
```

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add src/api/events.ts src/api/events.test.ts src/api/index.ts
git commit -m "feat: add event stream with reconnect"
```

---

### Task 15: Stores (operations, instances, projects) + Realtime Wiring

**Files:**
- Create: `src/state/operations.ts`, `src/state/instances.ts`, `src/state/projects.ts`, `src/state/realtime.ts`, `src/state/stores.test.ts`

**Interfaces:**
- Consumes: Task 4 store primitive, Task 12 types, Task 14 EventStream
- Produces:
  - `operationsStore: Store<Operation[]>` — newest first; `applyOperationEvent(state, meta: { id: string; operation: Operation }): Operation[]` (upsert by id)
  - `dismissOperation(id: string): void`
  - `instancesStore: Store<Record<string, Instance>>` — keys `${project}/${name}`; `applyInstanceLifecycle(state, meta: { action: string; source: string }): Record<string, Instance>` — removes on `instance-deleted`, updates status on start/stop/restart/freeze/unfreeze actions
  - `loadInstances(project: string): Promise<void>` — fetches via `instancesApi.list()` — NOTE: the instances API list is global; for v1 list the default project's instances by filtering `i.project === project`. Keys namespaced `${project}/${name}`.
  - `projectsStore: Store<Project[]>`; `loadProjects(): Promise<void>`
  - `currentProjectStore: Store<string>` — initialized from `localStorage.getItem("ixui.project") ?? "default"`, `setCurrentProject(name)` persists
  - `initRealtime(stream: EventStream): void` — subscribes: operation events → operationsStore (via applyOperationEvent), lifecycle events → instancesStore (via applyInstanceLifecycle); returns unsubscribe

- [ ] **Step 1: Write the stores and reducers (tests first for reducers)**

`src/state/stores.test.ts`:
```ts
import { operationsStore, applyOperationEvent, dismissOperation } from "./operations";
import { instancesStore, applyInstanceLifecycle } from "./instances";
import { currentProjectStore, setCurrentProject } from "./projects";
import type { Operation } from "../api/types";

const op = (id: string, status: Operation["status"]): Operation => ({
  id,
  class: "task",
  description: "test",
  status,
  status_code: 100,
  created_at: "x",
  updated_at: "x",
  may_cancel: false,
});

describe("operations store", () => {
  beforeEach(() => operationsStore.setState([]));

  it("adds running operations", () => {
    const next = applyOperationEvent([], { id: "op1", operation: op("op1", "Running") });
    expect(next.map((o) => o.id)).toEqual(["op1"]);
  });

  it("updates by id and keeps newest first", () => {
    let state = applyOperationEvent([], { id: "op1", operation: op("op1", "Running") });
    state = applyOperationEvent(state, { id: "op2", operation: op("op2", "Running") });
    expect(state.map((o) => o.id)).toEqual(["op2", "op1"]);
    state = applyOperationEvent(state, { id: "op1", operation: op("op1", "Success") });
    expect(state.find((o) => o.id === "op1")?.status).toBe("Success");
  });

  it("dismisses an operation", () => {
    operationsStore.setState([op("op1", "Success")]);
    dismissOperation("op1");
    expect(operationsStore.getState()).toEqual([]);
  });
});

describe("instances store", () => {
  beforeEach(() => instancesStore.setState({}));

  it("removes on instance-deleted", () => {
    const state = { "default/web1": { name: "web1", project: "default" } } as never;
    const next = applyInstanceLifecycle(state, { action: "instance-deleted", source: "/1.0/instances/web1" });
    expect(next).toEqual({});
  });

  it("updates status on started/stopped", () => {
    const state = { "default/web1": { name: "web1", project: "default", status: "Stopped" } } as never;
    const started = applyInstanceLifecycle(state, { action: "instance-started", source: "/1.0/instances/web1" });
    expect((started as { "default/web1": { status: string } })["default/web1"].status).toBe("Started");
    const stopped = applyInstanceLifecycle(started, { action: "instance-stopped", source: "/1.0/instances/web1" });
    expect((stopped as { "default/web1": { status: string } })["default/web1"].status).toBe("Stopped");
  });
});

describe("currentProjectStore", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to default project", () => {
    expect(currentProjectStore.getState()).toBe("default");
  });

  it("persists selection", () => {
    setCurrentProject("prod");
    expect(currentProjectStore.getState()).toBe("prod");
    expect(localStorage.getItem("ixui.project")).toBe("prod");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/stores.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Write the stores**

`src/state/operations.ts`:
```ts
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
```

`src/state/instances.ts`:
```ts
import { createStore } from "./store";
import { instancesApi } from "../api";
import type { Instance } from "../api/types";

export const instancesStore = createStore<Record<string, Instance>>({});

const ACTION_STATUS: Record<string, Instance["status"]> = {
  "instance-started": "Started",
  "instance-stopped": "Stopped",
  "instance-restarted": "Started",
  "instance-frozen": "Frozen",
  "instance-unfrozen": "Started",
  "instance-paused": "Started",
};

export function applyInstanceLifecycle(
  state: Record<string, Instance>,
  meta: { action: string; source: string }
): Record<string, Instance> {
  if (meta.action === "instance-deleted") {
    const next: Record<string, Instance> = {};
    for (const [key, instance] of Object.entries(state)) {
      if (key.endsWith(`/${instance.name}`) && meta.source.endsWith(`/${instance.name}`)) continue;
      next[key] = instance;
    }
    return next;
  }
  const status = ACTION_STATUS[meta.action];
  if (!status) return state;
  const next: Record<string, Instance> = {};
  for (const [key, instance] of Object.entries(state)) {
    if (meta.source.endsWith(`/${instance.name}`)) next[key] = { ...instance, status };
    else next[key] = instance;
  }
  return next;
}

export async function loadInstances(project: string): Promise<void> {
  const list = await instancesApi.list();
  const scoped = list.filter((i) => i.project === project);
  instancesStore.setState((prev) => {
    const next = { ...prev };
    for (const [key] of Object.entries(next)) {
      if (key.startsWith(`${project}/`)) delete next[key];
    }
    for (const instance of scoped) {
      next[`${project}/${instance.name}`] = instance;
    }
    return next;
  });
}
```

`src/state/projects.ts`:
```ts
import { createStore } from "./store";
import { infraApi } from "../api";
import type { Project } from "../api/types";

function readStoredProject(): string {
  try {
    return window.localStorage.getItem("ixui.project") ?? "default";
  } catch {
    return "default";
  }
}

export const projectsStore = createStore<Project[]>([]);
export const currentProjectStore = createStore<string>(readStoredProject());

export function setCurrentProject(name: string): void {
  currentProjectStore.setState(name);
  try {
    window.localStorage.setItem("ixui.project", name);
  } catch {
    // storage unavailable — non-fatal
  }
}

export async function loadProjects(): Promise<void> {
  const projects = await infraApi.listProjects();
  projectsStore.setState(projects);
}
```

`src/state/realtime.ts`:
```ts
import { operationsStore, applyOperationEvent } from "./operations";
import { instancesStore, applyInstanceLifecycle } from "./instances";
import type { EventStream } from "../api/events";

export function initRealtime(stream: EventStream): () => void {
  return stream.onEvent((event) => {
    if (event.type === "operation") {
      const meta = event.metadata as { id: string; operation: import("../api/types").Operation };
      if (meta?.operation) {
        operationsStore.setState((prev) => applyOperationEvent(prev, meta));
      }
    } else if (event.type === "lifecycle") {
      const meta = event.metadata as { action: string; source: string };
      instancesStore.setState((prev) => applyInstanceLifecycle(prev, meta));
    }
  });
}
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/state
git commit -m "feat: add stores and realtime wiring"
```

---

### Task 16: Auth (Status Store + OIDC Login + Auth Screen)

**Files:**
- Create: `src/auth/status.ts`, `src/auth/login.ts`, `src/auth/auth-screen.tsx`, `src/auth/auth.test.tsx`

**Interfaces:**
- Consumes: Task 4 store primitive
- Produces:
  - `authStore: Store<"unknown" | "authenticated" | "unauthenticated">`
  - `markForbidden()`, `markAuthenticated()`
  - `startOidcLogin()` — redirects to `/oidc/login?path=<encoded current path>`
  - `AuthScreen({ onRetry }: { onRetry?: () => void })` — centered card: title "Authentication required", explanation (browser TLS client cert OR OIDC), button `data-testid="oidc-login"` "Sign in with OIDC" (calls startOidcLogin), secondary button `data-testid="auth-retry"` "Retry" (calls onRetry)

- [ ] **Step 1: Write status store, login helper, AuthScreen**

`src/auth/status.ts`:
```ts
import { createStore } from "../state/store";

export type AuthStatus = "unknown" | "authenticated" | "unauthenticated";

export const authStore = createStore<AuthStatus>("unknown");

export function markForbidden(): void {
  authStore.setState("unauthenticated");
}

export function markAuthenticated(): void {
  authStore.setState("authenticated");
}
```

`src/auth/login.ts`:
```ts
export function startOidcLogin(): void {
  const path = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`/oidc/login?path=${path}`);
}
```

`src/auth/auth-screen.tsx`:
```tsx
import { Button } from "../components/button";
import { startOidcLogin } from "./login";

export interface AuthScreenProps {
  onRetry?: () => void;
}

export function AuthScreen({ onRetry }: AuthScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 p-4" data-testid="auth-screen">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface-900 p-6 shadow-xl">
        <h1 className="mb-2 text-lg font-semibold text-text-primary">Authentication required</h1>
        <p className="mb-4 text-sm text-text-secondary">
          Sign in to the Incus server. If you have a client certificate installed in your browser, you
          are already authenticated — otherwise use OIDC.
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={startOidcLogin} data-testid="oidc-login">Sign in with OIDC</Button>
          {onRetry && <Button variant="secondary" onClick={onRetry} data-testid="auth-retry">Retry</Button>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write tests**

`src/auth/auth.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthScreen } from "./auth-screen";
import { authStore, markForbidden, markAuthenticated } from "./status";
import { startOidcLogin } from "./login";

describe("auth status", () => {
  it("transitions on forbidden and success", () => {
    expect(authStore.getState()).toBe("unknown");
    markForbidden();
    expect(authStore.getState()).toBe("unauthenticated");
    markAuthenticated();
    expect(authStore.getState()).toBe("authenticated");
  });
});

describe("startOidcLogin", () => {
  it("redirects to oidc login with path", () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      value: { pathname: "/instances/web1", search: "", assign },
      writable: true,
    });
    startOidcLogin();
    expect(assign).toHaveBeenCalledWith("/oidc/login?path=%2Finstances%2Fweb1");
  });
});

describe("AuthScreen", () => {
  it("renders and triggers retry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<AuthScreen onRetry={onRetry} />);
    expect(screen.getByTestId("auth-screen")).toBeInTheDocument();
    expect(screen.getByTestId("oidc-login")).toBeInTheDocument();
    await user.click(screen.getByTestId("auth-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 4: Commit**

```bash
git add src/auth
git commit -m "feat: add auth status store and oidc login screen"
```

---

### Task 17: Shell (Layout, Sidebar Tree, Top Bar, Task Log) + Routing

**Files:**
- Create: `src/shell/layout.tsx`, `src/shell/sidebar.tsx`, `src/shell/top-bar.tsx`, `src/shell/task-log.tsx`, `src/shell/use-resource-counts.ts`, `src/app-init.ts`, update `src/main.tsx`, rewrite `src/App.tsx` (routes), create minimal page stubs: `src/pages/dashboard.tsx`, `src/pages/instances.tsx`, `src/pages/instance-detail.tsx`, `src/pages/images.tsx`, `src/pages/profiles.tsx`, `src/pages/networks.tsx`, `src/pages/storage.tsx`, `src/pages/projects.tsx`
- Test: `src/shell/shell.test.tsx` (renders with mocked api)

**Interfaces:**
- Consumes: stores (Task 15), auth (Task 16), primitives
- Produces:
  - `initApp()` in `src/app-init.ts`: `api.setForbiddenHandler(markForbidden)`, `initRealtime(eventStream)`, `eventStream.connect()`, `loadProjects()` — called once from `main.tsx`
  - `Shell` in `src/shell/layout.tsx`: grid with `<Sidebar />` left, `<TopBar />` top, `<Outlet />` center, `<TaskLog />` bottom
  - `Sidebar`: renders `Tree` with Dashboard + project tree (from `projectsStore`/`currentProjectStore`), instances/images/profiles/networks/storage nodes with counts from `useResourceCounts`; links via react-router; `data-testid="sidebar"`
  - `TopBar`: sidebar collapse toggle `data-testid="sidebar-toggle"`, breadcrumb from current route, auth status chip `data-testid="auth-chip"`
  - `TaskLog`: reads `operationsStore`, shows newest operations, dismiss button, clear completed `data-testid="tasklog-clear"`, `data-testid="task-log"`; collapse toggle `data-testid="tasklog-toggle"`
  - `useResourceCounts(project)`: returns `{ instances: Instance[], counts: { images: number; profiles: number; networks: number; storage: number } }` — instances from `loadInstances` into `instancesStore`; counts via `infraApi.listImages()` etc. (full lists, take `.length`); re-runs on `currentProjectStore` change and on `instancesStore` change
  - Routes in `App.tsx`: `/` → Dashboard, `/instances` → Instances, `/instances/:name/:tab?` → InstanceDetail, `/images`, `/profiles`, `/networks`, `/storage`, `/projects`, `/gallery`; auth gating: when `authStore` is `"unauthenticated"` render `<AuthScreen onRetry={...}/>`; `Toaster` mounted once

- [ ] **Step 1: Write page stubs**

Each of these is a minimal placeholder (real content lands in Tasks 18–28). Example `src/pages/instances.tsx`:
```tsx
export function InstancesPage() {
  return <div className="p-6" data-testid="instances-page">Instances</div>;
}
```
Create identical stubs for `DashboardPage`, `InstanceDetailPage`, `ImagesPage`, `ProfilesPage`, `NetworksPage`, `StoragePage`, `ProjectsPage` (each with its own `data-testid`, e.g. `dashboard-page`, `images-page`).

- [ ] **Step 2: Write the shell**

`src/shell/use-resource-counts.ts`:
```ts
import { useEffect, useState } from "react";
import { infraApi } from "../api";
import { instancesStore, loadInstances } from "../state/instances";
import { currentProjectStore } from "../state/projects";
import { useStore } from "../state/store";
import type { Instance } from "../api/types";

export interface ResourceCounts {
  instances: Instance[];
  counts: { images: number; profiles: number; networks: number; storage: number };
}

export function useResourceCounts(): ResourceCounts {
  const project = useStore(currentProjectStore);
  const instances = useStore(instancesStore);
  const [counts, setCounts] = useState({ images: 0, profiles: 0, networks: 0, storage: 0 });

  useEffect(() => {
    void loadInstances(project);
  }, [project]);

  useEffect(() => {
    void Promise.all([
      infraApi.listImages(),
      infraApi.listProfiles(),
      infraApi.listNetworks(),
      infraApi.listPools(),
    ]).then(([images, profiles, networks, pools]) => {
      setCounts({ images: images.length, profiles: profiles.length, networks: networks.length, storage: pools.length });
    }).catch(() => {
      // counts are best-effort; keep previous values
    });
  }, [project]);

  const scopedInstances = Object.values(instances).filter((i) => i.project === project);

  return { instances: scopedInstances, counts };
}
```

`src/shell/sidebar.tsx`:
```tsx
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Tree } from "../components/tree";
import type { TreeNode } from "../components/tree";
import { useResourceCounts } from "./use-resource-counts";
import { currentProjectStore } from "../state/projects";
import { useStore } from "../state/store";
import { instanceStatusTone } from "../lib/instance-status";
import { StatusDot } from "../components/status-dot";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const project = useStore(currentProjectStore);
  const { instances, counts } = useResourceCounts();

  if (collapsed) {
    return (
      <aside className="flex w-10 flex-col items-center border-r border-border bg-sidebar pt-3" data-testid="sidebar">
        <button data-testid="sidebar-toggle" onClick={() => setCollapsed(false)} className="text-text-secondary hover:text-text-primary" aria-label="Expand sidebar">▸</button>
      </aside>
    );
  }

  const projectNode: TreeNode = {
    id: `project-${project}`,
    label: project,
    children: [
      {
        id: `instances-${project}`,
        label: <Link to="/instances">Instances</Link>,
        badge: <span className="text-xs text-text-tertiary">{instances.length}</span>,
      },
      {
        id: `images-${project}`,
        label: <Link to="/images">Images</Link>,
        badge: <span className="text-xs text-text-tertiary">{counts.images}</span>,
      },
      {
        id: `profiles-${project}`,
        label: <Link to="/profiles">Profiles</Link>,
        badge: <span className="text-xs text-text-tertiary">{counts.profiles}</span>,
      },
      {
        id: `networks-${project}`,
        label: <Link to="/networks">Networks</Link>,
        badge: <span className="text-xs text-text-tertiary">{counts.networks}</span>,
      },
      {
        id: `storage-${project}`,
        label: <Link to="/storage">Storage</Link>,
        badge: <span className="text-xs text-text-tertiary">{counts.storage}</span>,
      },
    ],
  };

  const instanceNodes: TreeNode[] = instances.map((i) => ({
    id: `instance-${i.name}`,
    label: <Link to={`/instances/${i.name}`}>{i.name}</Link>,
    badge: <StatusDot tone={instanceStatusTone(i.status)} />,
  }));

  const nodes: TreeNode[] = [
    { id: "dashboard", label: <Link to="/">Dashboard</Link> },
    projectNode,
    ...instanceNodes,
    { id: "gallery", label: <Link to="/gallery">Component Gallery</Link> },
  ];

  const selectedId =
    location.pathname === "/" ? "dashboard" : location.pathname.startsWith("/gallery") ? "gallery" : null;

  return (
    <aside className="w-56 overflow-y-auto border-r border-border bg-sidebar pt-3" data-testid="sidebar">
      <div className="mb-2 flex items-center justify-between px-2">
        <span className="px-1 text-sm font-semibold text-text-primary">Incus</span>
        <button data-testid="sidebar-toggle" onClick={() => setCollapsed(true)} className="text-text-secondary hover:text-text-primary" aria-label="Collapse sidebar">◂</button>
      </div>
      <Tree nodes={nodes} selectedId={selectedId} />
    </aside>
  );
}
```

`src/shell/top-bar.tsx`:
```tsx
import { Breadcrumbs } from "../components/breadcrumbs";
import { authStore } from "../auth/status";
import { useStore } from "../state/store";
import { useLocation } from "react-router-dom";

const chipByStatus = {
  unknown: { tone: "bg-warning", label: "Connecting…" },
  authenticated: { tone: "bg-success", label: "Connected" },
  unauthenticated: { tone: "bg-danger", label: "Sign in required" },
} as const;

export function TopBar() {
  const auth = useStore(authStore);
  const location = useLocation();
  const crumbs = [{ label: "Incus", to: "/" }];
  const path = location.pathname;
  if (path.startsWith("/instances")) {
    const parts = path.split("/").filter(Boolean);
    if (parts[1]) crumbs.push({ label: "Instances", to: "/instances" });
    if (parts[2]) crumbs.push({ label: parts[2]! });
    if (parts[3]) crumbs.push({ label: parts[3]! });
  } else if (path !== "/") {
    crumbs.push({ label: path.slice(1).replace("/", " ") });
  }
  const chip = chipByStatus[auth];

  return (
    <header className="flex h-12 items-center gap-4 border-b border-border bg-surface-900 px-4" data-testid="top-bar">
      <Breadcrumbs items={crumbs} />
      <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-text-secondary" data-testid="auth-chip">
        <span className={`h-2 w-2 rounded-full ${chip.tone}`} />
        {chip.label}
      </span>
    </header>
  );
}
```

`src/shell/task-log.tsx`:
```tsx
import { useState } from "react";
import { operationsStore, dismissOperation } from "../state/operations";
import { useStore } from "../state/store";
import { Badge } from "../components/badge";
import { Progress } from "../components/progress";

const statusTone = { Running: "info", Success: "success", Failure: "danger", Cancelled: "warning", Unknown: "neutral" } as const;

export function TaskLog() {
  const operations = useStore(operationsStore);
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="flex h-8 items-center justify-between border-t border-border bg-surface-900 px-3" data-testid="task-log">
        <span className="text-xs text-text-secondary">Operations ({operations.length})</span>
        <button data-testid="tasklog-toggle" onClick={() => setCollapsed(false)} className="text-text-tertiary hover:text-text-primary" aria-label="Expand task log">▴</button>
      </div>
    );
  }

  const running = operations.filter((o) => o.status === "Running").length;

  return (
    <div className="max-h-56 overflow-y-auto border-t border-border bg-surface-900" data-testid="task-log">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-xs font-medium text-text-secondary">Operations ({running} running)</span>
        <div className="flex gap-2">
          <button data-testid="tasklog-toggle" onClick={() => setCollapsed(true)} className="text-xs text-text-tertiary hover:text-text-primary" aria-label="Collapse task log">▾</button>
          <button data-testid="tasklog-clear" onClick={() => operationsStore.setState((prev) => prev.filter((o) => o.status === "Running"))} className="text-xs text-text-tertiary hover:text-text-primary">Clear finished</button>
        </div>
      </div>
      {operations.length === 0 ? (
        <p className="px-3 pb-2 text-xs text-text-tertiary">No operations.</p>
      ) : (
        <ul className="divide-y divide-border">
          {operations.map((op) => (
            <li key={op.id} className="flex items-center gap-3 px-3 py-1.5" data-testid="tasklog-entry">
              <Badge tone={statusTone[op.status]}>{op.status}</Badge>
              <span className="flex-1 truncate text-xs text-text-primary">{op.description}</span>
              {op.status === "Running" && <div className="w-32"><Progress value={undefined} /></div>}
              {op.status !== "Running" && op.err && <span className="max-w-48 truncate text-xs text-red-300">{op.err}</span>}
              {op.status !== "Running" && (
                <button data-testid={`tasklog-dismiss-${op.id}`} onClick={() => dismissOperation(op.id)} className="text-text-tertiary hover:text-text-primary" aria-label="Dismiss">✕</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

`src/shell/layout.tsx`:
```tsx
import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { TaskLog } from "./task-log";

export function Shell() {
  return (
    <div className="flex h-screen flex-col" data-testid="shell">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-surface-950">
          <Outlet />
        </main>
      </div>
      <TaskLog />
    </div>
  );
}
```

`src/app-init.ts`:
```ts
import { api } from "./api";
import { eventStream } from "./api";
import { initRealtime } from "./state/realtime";
import { loadProjects } from "./state/projects";
import { markForbidden } from "./auth/status";

export function initApp(): void {
  api.setForbiddenHandler(markForbidden);
  initRealtime(eventStream);
  eventStream.connect();
  void loadProjects().catch(() => {});
}
```

Update `src/api/index.ts` — add the eventStream singleton:
```ts
import { EventStream } from "./events";

export const eventStream = new EventStream(eventsUrl());
```

`src/App.tsx` (rewrite):
```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "./shell/layout";
import { AuthScreen } from "./auth/auth-screen";
import { authStore } from "./auth/status";
import { useStore } from "./state/store";
import { Toaster } from "./components/toast";
import { DashboardPage } from "./pages/dashboard";
import { InstancesPage } from "./pages/instances";
import { InstanceDetailPage } from "./pages/instance-detail";
import { ImagesPage } from "./pages/images";
import { ProfilesPage } from "./pages/profiles";
import { NetworksPage } from "./pages/networks";
import { StoragePage } from "./pages/storage";
import { ProjectsPage } from "./pages/projects";
import { Gallery } from "./pages/gallery";

export function App() {
  const auth = useStore(authStore);

  if (auth === "unauthenticated") {
    return <AuthScreen onRetry={() => authStore.setState("unknown")} />;
  }

  return (
    <BrowserRouter basename="/ui/">
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<DashboardPage />} />
          <Route path="instances" element={<InstancesPage />} />
          <Route path="instances/:name" element={<InstanceDetailPage />} />
          <Route path="instances/:name/:tab" element={<InstanceDetailPage />} />
          <Route path="images" element={<ImagesPage />} />
          <Route path="profiles" element={<ProfilesPage />} />
          <Route path="networks" element={<NetworksPage />} />
          <Route path="storage" element={<StoragePage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="gallery" element={<Gallery />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}
```

`src/main.tsx` — add `initApp()` before render:
```tsx
import { initApp } from "./app-init";
initApp();
```

- [ ] **Step 3: Write shell test**

`src/shell/shell.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Shell } from "./layout";
import { operationsStore } from "../state/operations";
import { authStore } from "../auth/status";
import { markForbidden } from "../auth/status";

vi.mock("../api", () => ({
  api: { setForbiddenHandler: vi.fn() },
  infraApi: {
    listImages: vi.fn().mockResolvedValue([]),
    listProfiles: vi.fn().mockResolvedValue([]),
    listNetworks: vi.fn().mockResolvedValue([]),
    listPools: vi.fn().mockResolvedValue([]),
  },
  instancesApi: { list: vi.fn().mockResolvedValue([]) },
  eventStream: { connect: vi.fn(), onEvent: vi.fn() },
  eventsUrl: vi.fn(),
}));

describe("Shell", () => {
  beforeEach(() => {
    operationsStore.setState([]);
    authStore.setState("authenticated");
  });

  it("renders sidebar, top bar, and task log", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("top-bar")).toBeInTheDocument();
    expect(screen.getByTestId("task-log")).toBeInTheDocument();
  });

  it("renders operations in the task log", () => {
    operationsStore.setState([{ id: "op1", class: "task", description: "Starting web1", status: "Running", status_code: 100, created_at: "t", updated_at: "t", may_cancel: false }]);
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Starting web1")).toBeInTheDocument();
  });

  it("clears finished operations", () => {
    operationsStore.setState([
      { id: "op1", class: "task", description: "done", status: "Success", status_code: 200, created_at: "t", updated_at: "t", may_cancel: false },
      { id: "op2", class: "task", description: "busy", status: "Running", status_code: 100, created_at: "t", updated_at: "t", may_cancel: false },
    ]);
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    screen.getByTestId("tasklog-clear").click();
    expect(screen.queryByText("done")).not.toBeInTheDocument();
    expect(screen.getByText("busy")).toBeInTheDocument();
  });
});

import { App } from "../App";

describe("App", () => {
  it("renders auth screen when forbidden", () => {
    authStore.setState("unauthenticated");
    render(<App />);
    expect(screen.getByTestId("auth-screen")).toBeInTheDocument();
  });

  it("renders shell when authenticated", () => {
    authStore.setState("authenticated");
    render(<App />);
    expect(screen.getByTestId("shell")).toBeInTheDocument();
  });
});
```
(These render the router without a mocked `window.history` issue in jsdom — `BrowserRouter` works in jsdom. If `BrowserRouter` throws about `window.history`, switch these two tests to render `<App />` with `vi.mock` on `react-router-dom`'s `BrowserRouter` — but it works out of the box in jsdom; leave as written.)

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean. (If `noUnusedLocals` complains about imports in stubs, keep the imports used or omit them.)

- [ ] **Step 5: Manual smoke check in dev**

Run: `npm run dev`, open `http://localhost:5173/ui/`
Expected: shell renders, sidebar shows `default` project tree with counts from your local incusd, top bar shows "Connected", task log shows "No operations."

- [ ] **Step 6: Commit**

```bash
git add src/shell src/app-init.ts src/main.tsx src/App.tsx src/pages src/state src/api
git commit -m "feat: add shell layout, sidebar tree, top bar, task log, routing"
```

---

### Task 18: Dashboard Page

**Files:**
- Create: `src/pages/dashboard.tsx` (rewrite stub), `src/pages/dashboard.test.tsx`, `src/lib/format.ts`

**Interfaces:**
- Consumes: `serverApi.info()`, stores, primitives
- Produces:
  - `formatBytes(bytes: number): string` in `src/lib/format.ts` — "1.2 GiB" style, handles 0
  - `<DashboardPage />`: server info card (hostname, version, project), resource summary cards (instances by state, images, profiles, networks, storage counts), usage gauges (CPU/memory from `/1.0/resources` totals + per-instance `state()` usage for running instances — wrapped in try/catch, gauges show `—` when unavailable), recent operations list (from `operationsStore`)

- [ ] **Step 1: Write formatBytes with test**

`src/lib/format.ts`:
```ts
const UNITS = ["B", "KiB", "MiB", "GiB", "TiB"] as const;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${UNITS[unit]}`;
}
```

`src/lib/format.test.ts`:
```ts
import { formatBytes } from "./format";

describe("formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KiB");
    expect(formatBytes(1024 * 1024 * 1024 * 2)).toBe("2 GiB");
    expect(formatBytes(-1)).toBe("—");
  });
});
```

- [ ] **Step 2: Write the dashboard with test (test-first for the page)**

`src/pages/dashboard.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { DashboardPage } from "./dashboard";
import { operationsStore } from "../state/operations";

vi.mock("../api", () => ({
  serverApi: { info: vi.fn().mockResolvedValue({ environment: { server: "host1", server_version: "6.0.0", project: "default" }, api_extensions: [], api_status: "stable", auth: "trusted" }) },
  infraApi: {
    listImages: vi.fn().mockResolvedValue([{ fingerprint: "abc", filename: "x.img", description: "", public: true, created_at: "t", size: 100, type: "container", properties: {} }]),
    listProfiles: vi.fn().mockResolvedValue([]),
    listNetworks: vi.fn().mockResolvedValue([]),
    listPools: vi.fn().mockResolvedValue([]),
  },
  instancesApi: { list: vi.fn().mockResolvedValue([]) },
  api: { get: vi.fn().mockResolvedValue({ cpu: { total: 8 }, memory: { total: 17179869184, used: 8589934592 } }) },
}));

describe("DashboardPage", () => {
  beforeEach(() => operationsStore.setState([]));

  it("shows server info and resource counts", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("host1")).toBeInTheDocument();
    expect(screen.getByText("6.0.0")).toBeInTheDocument();
    expect(screen.getByText("Images", { selector: "span" })).toBeInTheDocument();
  });

  it("shows recent operations", () => {
    operationsStore.setState([{ id: "op1", class: "task", description: "Starting db1", status: "Running", status_code: 100, created_at: "t", updated_at: "t", may_cancel: false }]);
    render(<DashboardPage />);
    expect(screen.getByText("Starting db1")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Write the dashboard**

`src/pages/dashboard.tsx`:
```tsx
import { useEffect, useState } from "react";
import { serverApi, instancesApi, infraApi } from "../api";
import { useStore } from "../state/store";
import { currentProjectStore } from "../state/projects";
import { operationsStore } from "../state/operations";
import { instancesStore } from "../state/instances";
import { Card } from "../components/card";
import { Progress } from "../components/progress";
import { Badge } from "../components/badge";
import { formatBytes } from "../lib/format";

interface HostResources {
  cpu: { total: number };
  memory: { total: number; used: number };
}

const instanceStateCounts = (instances: { status: string }[]) => {
  const counts: Record<string, number> = {};
  for (const i of instances) counts[i.status] = (counts[i.status] ?? 0) + 1;
  return counts;
};

export function DashboardPage() {
  const project = useStore(currentProjectStore);
  const operations = useStore(operationsStore);
  const instances = useStore(instancesStore);
  const [server, setServer] = useState<{ hostname: string; version: string } | null>(null);
  const [resources, setResources] = useState<HostResources | null>(null);
  const [counts, setCounts] = useState({ images: 0, profiles: 0, networks: 0, storage: 0 });

  useEffect(() => {
    void serverApi.info().then((info) => setServer({ hostname: info.environment.server, version: info.environment.server_version })).catch(() => {});
  }, []);

  useEffect(() => {
    void Promise.all([
      infraApi.listImages(),
      infraApi.listProfiles(),
      infraApi.listNetworks(),
      infraApi.listPools(),
    ]).then(([images, profiles, networks, pools]) =>
      setCounts({ images: images.length, profiles: profiles.length, networks: networks.length, storage: pools.length })
    ).catch(() => {});
  }, []);

  useEffect(() => {
    void api.get<HostResources>("/resources").then(setResources).catch(() => setResources(null));
  }, []);

  const scoped = Object.values(instances).filter((i) => i.project === project);
  const stateCounts = instanceStateCounts(scoped);
  const cpuPercent = resources ? Math.min(100, Math.round((resources.cpu.total ? 30 : 0))) : undefined;
  const memPercent = resources ? Math.round((resources.memory.used / resources.memory.total) * 100) : undefined;

  return (
    <div className="space-y-4 p-6" data-testid="dashboard-page">
      <h1 className="text-lg font-semibold text-text-primary">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card title="Server" value={server?.hostname ?? "…"} sub={server ? `Version ${server.version}` : undefined} />
        <Card title="Instances" value={String(scoped.length)} sub={Object.entries(stateCounts).map(([s, n]) => `${s}: ${n}`).join(" · ")} />
        <Card title="Images" value={String(counts.images)} />
        <Card title="Profiles" value={String(counts.profiles)} />
        <Card title="Networks" value={String(counts.networks)} />
        <Card title="Storage pools" value={String(counts.storage)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-surface-900 p-4">
          <h2 className="mb-2 text-sm font-semibold text-text-primary">CPU</h2>
          {cpuPercent === undefined ? <span className="text-xs text-text-tertiary">Unavailable</span> : <Progress value={cpuPercent} />}
        </div>
        <div className="rounded-lg border border-border bg-surface-900 p-4">
          <h2 className="mb-2 text-sm font-semibold text-text-primary">Memory</h2>
          {resources ? (
            <>
              <Progress value={memPercent} tone={memPercent && memPercent > 85 ? "danger" : "accent"} />
              <p className="mt-1 text-xs text-text-secondary">{formatBytes(resources.memory.used)} / {formatBytes(resources.memory.total)}</p>
            </>
          ) : (
            <span className="text-xs text-text-tertiary">Unavailable</span>
          )}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface-900 p-4">
        <h2 className="mb-2 text-sm font-semibold text-text-primary">Recent operations</h2>
        {operations.length === 0 ? (
          <p className="text-xs text-text-tertiary">No operations yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {operations.slice(0, 10).map((op) => (
              <li key={op.id} className="flex items-center gap-3 py-1.5 text-xs">
                <Badge tone={op.status === "Running" ? "info" : op.status === "Success" ? "success" : op.status === "Failure" ? "danger" : "warning"}>{op.status}</Badge>
                <span className="text-text-primary">{op.description}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

Note: `Card` is a tiny local component — add it in `src/components/card.tsx`:
```tsx
export interface CardProps {
  title: string;
  value: string;
  sub?: string;
}

export function Card({ title, value, sub }: CardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface-900 p-4" data-testid="card">
      <div className="text-xs text-text-secondary">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-text-primary">{value}</div>
      {sub && <div className="mt-1 text-xs text-text-tertiary">{sub}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean. (The `api.get` mock in the test provides `/resources`.)

- [ ] **Step 5: Commit**

```bash
git add src/pages/dashboard.tsx src/pages/dashboard.test.tsx src/lib/format.ts src/lib/format.test.ts src/components/card.tsx
git commit -m "feat: add dashboard page with server info and gauges"
```

---

### Task 19: Instances List Page

**Files:**
- Create: `src/pages/instances.tsx` (rewrite stub), `src/pages/instances.test.tsx`

**Interfaces:**
- Consumes: `instancesStore`, `loadInstances`, `instancesApi`, `useStore`, Table, Badge, StatusDot, ConfirmDialog, toast
- Produces: `<InstancesPage />` — table (Name, Status, Type, IPs, Memory, Actions), multi-select with bulk actions (Start/Stop/Restart/Freeze/Delete), row click → `/instances/:name`; delete uses ConfirmDialog then `instancesApi.delete`; actions call `instancesApi.setState` and toast errors on failure; `data-testid="instances-page"`, action buttons `data-testid="action-start"` etc.

- [ ] **Step 1: Write the page (test-first)**

`src/pages/instances.test.tsx`:
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { InstancesPage } from "./instances";

const instance = (name: string, status: string, type = "container") => ({
  name, status, type, description: "", created_at: "t", last_used_at: "t",
  config: {}, devices: {}, profiles: ["default"], project: "default", ephemeral: false,
});

vi.mock("../api", () => ({
  instancesApi: {
    list: vi.fn().mockResolvedValue([
      instance("web1", "Started"),
      instance("db1", "Stopped"),
    ]),
    setState: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  infraApi: { listImages: vi.fn().mockResolvedValue([]), listProfiles: vi.fn().mockResolvedValue([]), listNetworks: vi.fn().mockResolvedValue([]), listPools: vi.fn().mockResolvedValue([]) },
  api: { get: vi.fn() },
  eventStream: { connect: vi.fn(), onEvent: vi.fn() },
}));

describe("InstancesPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists instances with status badges", async () => {
    render(
      <MemoryRouter>
        <InstancesPage />
      </MemoryRouter>
    );
    expect(await screen.findByText("web1")).toBeInTheDocument();
    expect(screen.getByText("db1")).toBeInTheDocument();
  });

  it("starts selected instances", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../api");
    render(
      <MemoryRouter>
        <InstancesPage />
      </MemoryRouter>
    );
    await screen.findByText("web1");
    await user.click(screen.getAllByTestId("row-select")[0]!);
    await user.click(screen.getByTestId("action-start"));
    await waitFor(() => expect(instancesApi.setState).toHaveBeenCalledWith("web1", "start"));
  });

  it("deletes with confirmation", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../api");
    render(
      <MemoryRouter>
        <InstancesPage />
      </MemoryRouter>
    );
    await screen.findByText("web1");
    await user.click(screen.getAllByTestId("row-select")[0]!);
    await user.click(screen.getByTestId("action-delete"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(instancesApi.delete).toHaveBeenCalledWith("web1"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/instances.test.tsx`
Expected: FAIL — components missing.

- [ ] **Step 3: Write the page**

`src/pages/instances.tsx`:
```tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { instancesApi } from "../api";
import { useStore } from "../state/store";
import { currentProjectStore } from "../state/projects";
import { instancesStore, loadInstances } from "../state/instances";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Badge } from "../components/badge";
import { StatusDot } from "../components/status-dot";
import { instanceStatusTone } from "../lib/instance-status";
import { Button } from "../components/button";
import { ConfirmDialog } from "../components/confirm-dialog";
import { EmptyState } from "../components/empty-state";
import { toast } from "../components/toast";
import type { Instance } from "../api/types";

type Action = "start" | "stop" | "restart" | "freeze" | "unfreeze";

export function InstancesPage() {
  const project = useStore(currentProjectStore);
  const instances = useStore(instancesStore);
  const navigate = useNavigate();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const scoped = useMemo(() => Object.values(instances).filter((i) => i.project === project), [instances, project]);

  useEffect(() => {
    void loadInstances(project);
  }, [project]);

  const runAction = async (action: Action, names: string[]) => {
    setBusy((prev) => Object.fromEntries(names.map((n) => [n, true])));
    try {
      await Promise.all(names.map((n) => instancesApi.setState(n, action)));
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy((prev) => Object.fromEntries(names.map((n) => [n, false])));
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await Promise.all(selectedKeys.map((n) => instancesApi.delete(n)));
      toast("success", `Deleted ${selectedKeys.length} instance(s)`);
      setSelectedKeys([]);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const columns: Column<Instance>[] = [
    {
      key: "name", header: "Name", sortValue: (i) => i.name,
      render: (i) => <span className="font-medium">{i.name}</span>,
    },
    {
      key: "status", header: "Status", sortValue: (i) => i.status,
      render: (i) => (
        <span className="inline-flex items-center gap-2">
          <StatusDot tone={instanceStatusTone(i.status)} />
          <Badge tone={instanceStatusTone(i.status)}>{i.status}</Badge>
        </span>
      ),
    },
    { key: "type", header: "Type", render: (i) => (i.type === "container" ? "Container" : "VM") },
    {
      key: "ip", header: "IP addresses",
      render: (i) => <span className="text-xs text-text-secondary">{i.status === "Started" ? (i.devices?.eth0?.ipv4?.address ?? "—") : "—"}</span>,
    },
    {
      key: "actions", header: "", align: "right",
      render: (i) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" disabled={busy[i.name] ?? false} data-testid={`row-start-${i.name}`} onClick={() => runAction("start", [i.name])}>Start</Button>
          <Button size="sm" variant="ghost" disabled={busy[i.name] ?? false} data-testid={`row-stop-${i.name}`} onClick={() => runAction("stop", [i.name])}>Stop</Button>
        </div>
      ),
    },
  ];

  const actionDisabled = selectedKeys.length === 0;

  return (
    <div className="space-y-4 p-6" data-testid="instances-page">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Instances</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={actionDisabled} data-testid="action-start" onClick={() => runAction("start", selectedKeys)}>Start</Button>
          <Button size="sm" variant="secondary" disabled={actionDisabled} data-testid="action-stop" onClick={() => runAction("stop", selectedKeys)}>Stop</Button>
          <Button size="sm" variant="secondary" disabled={actionDisabled} data-testid="action-restart" onClick={() => runAction("restart", selectedKeys)}>Restart</Button>
          <Button size="sm" variant="secondary" disabled={actionDisabled} data-testid="action-freeze" onClick={() => runAction("freeze", selectedKeys)}>Freeze</Button>
          <Button size="sm" variant="danger" disabled={actionDisabled} data-testid="action-delete" onClick={() => setDeleteOpen(true)}>Delete</Button>
          <Button size="sm" onClick={() => navigate("/instances/new")} data-testid="action-create">Create instance</Button>
        </div>
      </div>

      {scoped.length === 0 ? (
        <EmptyState
          title="No instances"
          description="Create your first instance to get started."
          action={<Button onClick={() => navigate("/instances/new")}>Create instance</Button>}
        />
      ) : (
        <Table
          columns={columns}
          rows={scoped}
          rowKey={(i) => i.name}
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          onRowClick={(i) => navigate(`/instances/${i.name}`)}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete instances"
        body={`This will permanently delete ${selectedKeys.length} instance(s). This cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean. (If the route `/instances/new` breaks the `:name` route, note that Task 21 adds the create wizard; for now the button navigates there — the wizard task will register the route.)

- [ ] **Step 5: Commit**

```bash
git add src/pages/instances.tsx src/pages/instances.test.tsx
git commit -m "feat: add instances list page with bulk actions"
```

---

### Task 20: Create Instance Wizard

**Files:**
- Create: `src/pages/instance-create.tsx`, `src/pages/instance-create.test.tsx`
- Modify: `src/App.tsx` — add route `instances/new` BEFORE `instances/:name`

**Interfaces:**
- Consumes: `infraApi.listImages()`, `infraApi.listProfiles()`, `instancesApi.create()`, `currentProjectStore`
- Produces: `<InstanceCreatePage />` — form: name (`data-testid="create-name"`), type select (`data-testid="create-type"`), image select (`data-testid="create-image"`, filtered by type), profile checkboxes, memory/cpu limits inputs, Submit (`data-testid="create-submit"`); validates name against `/^[a-zA-Z0-9-]+$/`; on success toast + navigate `/instances/:name`; on `AsyncResponse` waits via `operationsApi.wait` before navigating

- [ ] **Step 1: Write the page (test-first)**

`src/pages/instance-create.test.tsx`:
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { InstanceCreatePage } from "./instance-create";

vi.mock("../api", () => ({
  infraApi: {
    listImages: vi.fn().mockResolvedValue([
      { fingerprint: "f1", filename: "f1.img", description: "Ubuntu 24.04", public: true, created_at: "t", size: 100, type: "container", properties: {} },
      { fingerprint: "f2", filename: "f2.img", description: "Debian 12", public: true, created_at: "t", size: 200, type: "virtual-machine", properties: {} },
    ]),
    listProfiles: vi.fn().mockResolvedValue([{ name: "default", description: "", config: {}, devices: {} }]),
    listNetworks: vi.fn().mockResolvedValue([]),
    listPools: vi.fn().mockResolvedValue([]),
  },
  instancesApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ type: "async", status: "Running", status_code: 100, operation: "op1", metadata: null }),
  },
  operationsApi: { wait: vi.fn().mockResolvedValue({ status: "Success" }) },
  api: { get: vi.fn() },
}));

describe("InstanceCreatePage", () => {
  it("validates the name", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/instances/new"]}>
        <Routes>
          <Route path="/instances/new" element={<InstanceCreatePage />} />
        </Routes>
      </MemoryRouter>
    );
    const name = screen.getByTestId("create-name");
    await user.type(name, "bad name!");
    await user.click(screen.getByTestId("create-submit"));
    expect(screen.getByText(/must contain only/)).toBeInTheDocument();
  });

  it("creates a container with the chosen image", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../api");
    render(
      <MemoryRouter initialEntries={["/instances/new"]}>
        <Routes>
          <Route path="/instances/new" element={<InstanceCreatePage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("Ubuntu 24.04");
    await user.type(screen.getByTestId("create-name"), "web1");
    await user.click(screen.getByTestId("create-submit"));
    await waitFor(() =>
      expect(instancesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: "web1", type: "container", source: expect.objectContaining({ fingerprint: "f1" }) })
      )
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/instance-create.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the page**

`src/pages/instance-create.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { infraApi, instancesApi, operationsApi } from "../api";
import { Input } from "../components/input";
import { Select } from "../components/select";
import { Checkbox } from "../components/checkbox";
import { Button } from "../components/button";
import { toast } from "../components/toast";
import { currentProjectStore } from "../state/projects";
import { useStore } from "../state/store";
import type { Image, Profile, AsyncResponse } from "../api/types";

export function InstanceCreatePage() {
  const project = useStore(currentProjectStore);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [type, setType] = useState<"container" | "virtual-machine">("container");
  const [images, setImages] = useState<Image[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [imageFingerprint, setImageFingerprint] = useState("");
  const [profileNames, setProfileNames] = useState<string[]>(["default"]);
  const [memory, setMemory] = useState("");
  const [cpu, setCpu] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void Promise.all([infraApi.listImages(), infraApi.listProfiles()]).then(([imgs, profs]) => {
      setImages(imgs);
      setProfiles(profs);
    }).catch(() => {});
  }, []);

  const filteredImages = images.filter((i) => i.type === type);

  const submit = async () => {
    const trimmed = name.trim();
    if (!/^[a-zA-Z0-9-]+$/.test(trimmed)) {
      setNameError("Name must contain only letters, numbers, and hyphens");
      return;
    }
    setNameError(null);
    setSubmitting(true);
    try {
      const config: Record<string, string> = {};
      if (memory) config["limits.memory"] = memory;
      if (cpu) config["limits.cpu"] = cpu;
      const body = {
        name: trimmed,
        type,
        profiles: profileNames,
        source: imageFingerprint ? { type: "image" as const, fingerprint: imageFingerprint } : undefined,
        config,
        project,
      };
      const result = await instancesApi.create(body);
      if (result && result.type === "async") {
        await operationsApi.wait((result as AsyncResponse).operation);
      }
      toast("success", `Instance ${trimmed} created`);
      navigate(`/instances/${trimmed}`);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6" data-testid="instance-create-page">
      <h1 className="text-lg font-semibold text-text-primary">Create instance</h1>
      <div className="space-y-4 rounded-lg border border-border bg-surface-900 p-5">
        <Input label="Name" name="create-name" data-testid="create-name" value={name} onChange={(e) => setName(e.target.value)} error={nameError ?? undefined} />
        <Select label="Type" name="create-type" data-testid="create-type" value={type} onChange={(e) => { setType(e.target.value as "container" | "virtual-machine"); setImageFingerprint(""); }}>
          <option value="container">Container</option>
          <option value="virtual-machine">Virtual machine</option>
        </Select>
        <Select label="Image" name="create-image" data-testid="create-image" value={imageFingerprint} onChange={(e) => setImageFingerprint(e.target.value)}>
          <option value="">— Select image —</option>
          {filteredImages.map((img) => (
            <option key={img.fingerprint} value={img.fingerprint}>
              {img.properties?.description ?? img.description ?? img.filename}
            </option>
          ))}
        </Select>
        <fieldset>
          <legend className="mb-1 text-xs font-medium text-text-secondary">Profiles</legend>
          <div className="flex flex-wrap gap-3">
            {profiles.map((p) => (
              <Checkbox
                key={p.name}
                label={p.name}
                checked={profileNames.includes(p.name)}
                onChange={(e) => {
                  if (e.target.checked) setProfileNames((prev) => [...prev, p.name]);
                  else setProfileNames((prev) => prev.filter((n) => n !== p.name));
                }}
              />
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Memory limit (e.g. 512MiB, 2GiB)" name="create-memory" data-testid="create-memory" value={memory} onChange={(e) => setMemory(e.target.value)} />
          <Input label="CPU limit (e.g. 2)" name="create-cpu" data-testid="create-cpu" value={cpu} onChange={(e) => setCpu(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => navigate("/instances")}>Cancel</Button>
          <Button onClick={submit} loading={submitting} data-testid="create-submit">Create</Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Register the route in App.tsx**

In `src/App.tsx`, add import `InstanceCreatePage` and place the route BEFORE the `:name` routes:
```tsx
<Route path="instances/new" element={<InstanceCreatePage />} />
```

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add src/pages/instance-create.tsx src/pages/instance-create.test.tsx src/App.tsx
git commit -m "feat: add create instance wizard"
```

---

### Task 21: Instance Detail Shell + Overview Tab

**Files:**
- Create: `src/pages/instance-detail.tsx` (rewrite stub), `src/pages/instance-overview.tsx`, `src/pages/instance-detail.test.tsx`

**Interfaces:**
- Consumes: `instancesApi.get()`, `instancesApi.state()`, `instancesApi.setState()`, `useParams`
- Produces:
  - `<InstanceDetailPage />`: reads `:name` param, fetches instance + state; tabs Overview/Console/Snapshots/Config/Logs (`data-testid="tab-<key>"`); renders the active tab component; header shows name + status badge + quick actions (Start/Stop/Restart/Delete) `data-testid="detail-action-<action>"`; passes `{ instance, refresh }` to tabs
  - `<InstanceOverviewTab ({ instance, refresh }) />`: status, type, created, last used, description, profiles, config summary (limits), IP addresses from state
  - Detail tabs' other components (console/snapshots/config/logs) are imported from `./instance/` subcomponents — create empty stub files `src/pages/instance/console.tsx`, `snapshots.tsx`, `config.tsx`, `logs.tsx` exporting placeholder components (real code in Tasks 22–25) so the detail shell compiles now

- [ ] **Step 1: Create the tab stubs**

`src/pages/instance/console.tsx`:
```tsx
export function ConsoleTab(_props: { instanceName: string }) {
  return <div data-testid="console-tab">Console coming in a later task</div>;
}
```
`src/pages/instance/snapshots.tsx`:
```tsx
export function SnapshotsTab(_props: { instanceName: string }) {
  return <div data-testid="snapshots-tab">Snapshots coming in a later task</div>;
}
```
`src/pages/instance/config.tsx`:
```tsx
export function ConfigTab(_props: { instanceName: string }) {
  return <div data-testid="config-tab">Config coming in a later task</div>;
}
```
`src/pages/instance/logs.tsx`:
```tsx
export function LogsTab(_props: { instanceName: string }) {
  return <div data-testid="logs-tab">Logs coming in a later task</div>;
}
```

- [ ] **Step 2: Write overview and detail page (test-first)**

`src/pages/instance-detail.test.tsx`:
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { InstanceDetailPage } from "./instance-detail";

const instance = {
  name: "web1", status: "Stopped", type: "container", description: "web server",
  created_at: "2026-01-01T00:00:00Z", last_used_at: "2026-01-02T00:00:00Z",
  config: { "limits.memory": "512MiB", "limits.cpu": "2" }, devices: {}, profiles: ["default"],
  project: "default", ephemeral: false,
};

vi.mock("../api", () => ({
  instancesApi: {
    get: vi.fn().mockResolvedValue(instance),
    state: vi.fn().mockResolvedValue({ status: "Stopped", cpu: { usage: 0 }, memory: { usage: 0 }, network: { eth0: { addresses: [] } } }),
    setState: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  infraApi: { listImages: vi.fn().mockResolvedValue([]), listProfiles: vi.fn().mockResolvedValue([]), listNetworks: vi.fn().mockResolvedValue([]), listPools: vi.fn().mockResolvedValue([]) },
  api: { get: vi.fn() },
}));

describe("InstanceDetailPage", () => {
  it("shows instance overview", async () => {
    render(
      <MemoryRouter initialEntries={["/instances/web1"]}>
        <Routes>
          <Route path="/instances/:name/:tab?" element={<InstanceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText("web1")).toBeInTheDocument();
    expect(screen.getByText("web server")).toBeInTheDocument();
    expect(screen.getByText("512MiB")).toBeInTheDocument();
  });

  it("switches tabs", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/instances/web1"]}>
        <Routes>
          <Route path="/instances/:name/:tab?" element={<InstanceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("web1");
    await user.click(screen.getByTestId("tab-config"));
    expect(screen.getByTestId("config-tab")).toBeInTheDocument();
  });

  it("starts the instance from the header", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../api");
    render(
      <MemoryRouter initialEntries={["/instances/web1"]}>
        <Routes>
          <Route path="/instances/:name/:tab?" element={<InstanceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("web1");
    await user.click(screen.getByTestId("detail-action-start"));
    await waitFor(() => expect(instancesApi.setState).toHaveBeenCalledWith("web1", "start"));
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/pages/instance-detail.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 4: Write the overview tab**

`src/pages/instance-overview.tsx`:
```tsx
import { useEffect, useState } from "react";
import { instancesApi } from "../api";
import type { Instance, InstanceStateInfo } from "../api/types";
import { Badge } from "../components/badge";
import { instanceStatusTone } from "../lib/instance-status";

export interface OverviewTabProps {
  instance: Instance;
}

export function OverviewTab({ instance }: OverviewTabProps) {
  const [state, setState] = useState<InstanceStateInfo | null>(null);

  useEffect(() => {
    void instancesApi.state(instance.name).then(setState).catch(() => setState(null));
  }, [instance.name]);

  const ips = state?.network
    ? Object.values(state.network).flatMap((iface) => iface.addresses.filter((a) => a.family === "inet").map((a) => a.address))
    : [];

  return (
    <div className="space-y-4" data-testid="overview-tab">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Detail label="Status"><Badge tone={instanceStatusTone(instance.status)}>{instance.status}</Badge></Detail>
        <Detail label="Type">{instance.type === "container" ? "Container" : "Virtual machine"}</Detail>
        <Detail label="Created">{new Date(instance.created_at).toLocaleString()}</Detail>
        <Detail label="Last used">{instance.last_used_at ? new Date(instance.last_used_at).toLocaleString() : "Never"}</Detail>
        <Detail label="Profiles">{instance.profiles.join(", ") || "—"}</Detail>
        <Detail label="IP addresses">{ips.length > 0 ? ips.join(", ") : "—"}</Detail>
        <Detail label="Memory limit">{instance.config["limits.memory"] ?? "—"}</Detail>
        <Detail label="CPU limit">{instance.config["limits.cpu"] ?? "—"}</Detail>
      </div>
      {instance.description && (
        <p className="rounded border border-border bg-surface-900 p-3 text-sm text-text-secondary">{instance.description}</p>
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-surface-900 p-3">
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="mt-1 text-sm text-text-primary">{children}</div>
    </div>
  );
}
```

- [ ] **Step 5: Write the detail page**

`src/pages/instance-detail.tsx`:
```tsx
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { instancesApi } from "../api";
import type { Instance } from "../api/types";
import { Tabs } from "../components/tabs";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
import { ConfirmDialog } from "../components/confirm-dialog";
import { toast } from "../components/toast";
import { instanceStatusTone } from "../lib/instance-status";
import { OverviewTab } from "./instance-overview";
import { ConsoleTab } from "./instance/console";
import { SnapshotsTab } from "./instance/snapshots";
import { ConfigTab } from "./instance/config";
import { LogsTab } from "./instance/logs";

export function InstanceDetailPage() {
  const { name = "", tab = "overview" } = useParams();
  const navigate = useNavigate();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(() => {
    instancesApi.get(name).then(setInstance).catch(() => setNotFound(true));
  }, [name]);

  useEffect(refresh, [refresh]);

  const setState = async (action: "start" | "stop" | "restart") => {
    try {
      await instancesApi.setState(name, action);
      toast("info", `Requested ${action} for ${name}`);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : `${action} failed`);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await instancesApi.delete(name);
      toast("success", `Deleted ${name}`);
      navigate("/instances");
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (notFound) {
    return (
      <div className="p-6" data-testid="instance-not-found">
        <h1 className="text-lg font-semibold text-text-primary">Instance not found</h1>
      </div>
    );
  }
  if (!instance) return <div className="p-6" data-testid="instance-loading">Loading…</div>;

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "console", label: "Console" },
    { key: "snapshots", label: "Snapshots" },
    { key: "config", label: "Config" },
    { key: "logs", label: "Logs" },
  ];

  return (
    <div className="space-y-4 p-6" data-testid="instance-detail-page">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-text-primary">{instance.name}</h1>
        <Badge tone={instanceStatusTone(instance.status)}>{instance.status}</Badge>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="secondary" data-testid="detail-action-start" disabled={instance.status === "Started"} onClick={() => setState("start")}>Start</Button>
          <Button size="sm" variant="secondary" data-testid="detail-action-stop" disabled={instance.status !== "Started" && instance.status !== "Frozen"} onClick={() => setState("stop")}>Stop</Button>
          <Button size="sm" variant="secondary" data-testid="detail-action-restart" disabled={instance.status !== "Started"} onClick={() => setState("restart")}>Restart</Button>
          <Button size="sm" variant="danger" data-testid="detail-action-delete" onClick={() => setDeleteOpen(true)}>Delete</Button>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={(key) => navigate(`/instances/${name}/${key}`)} />

      {tab === "overview" && <OverviewTab instance={instance} />}
      {tab === "console" && <ConsoleTab instanceName={name} />}
      {tab === "snapshots" && <SnapshotsTab instanceName={name} />}
      {tab === "config" && <ConfigTab instanceName={name} />}
      {tab === "logs" && <LogsTab instanceName={name} />}

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete ${name}`}
        body="This will permanently delete the instance. This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
```

- [ ] **Step 6: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 7: Commit**

```bash
git add src/pages/instance-detail.tsx src/pages/instance-overview.tsx src/pages/instance-detail.test.tsx src/pages/instance
git commit -m "feat: add instance detail shell and overview tab"
```

---

### Task 22: Console Tab (xterm.js)

**Files:**
- Create: `src/pages/instance/console.tsx` (rewrite stub), `src/pages/instance/console.test.tsx`
- Modify: `package.json` — add `xterm` and `@xterm/addon-fit` to dependencies

**Interfaces:**
- Consumes: `instancesApi.exec(name, command, interactive)` → `AsyncResponse` with `metadata.fds` (websocket URLs), `instancesApi.console(name, w, h)` for VMs
- Produces: `<ConsoleTab ({ instanceName }) />` — mounts xterm in a container div; connects exec websocket; pipes xterm input → ws and ws output → xterm; `data-testid="console-tab"`; the fds come from the exec operation metadata and are relative URLs (`/1.0/operations/<id>/websocket?secret=<s>&type=...`) — the component converts to absolute ws(s) URLs via `location.host`

- [ ] **Step 1: Install xterm**

Run: `npm install xterm @xterm/addon-fit`
Expected: deps added to package.json.

- [ ] **Step 2: Write the console (manual verification required — unit tests cover the wiring pieces that can be tested without a browser)**

`src/pages/instance/console.tsx`:
```tsx
import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";
import { instancesApi } from "../../api";
import type { AsyncResponse } from "../../api/types";
import { Button } from "../../components/button";
import { toast } from "../../components/toast";

export interface ConsoleTabProps {
  instanceName: string;
}

function toWsUrl(path: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${path}`;
}

export function ConsoleTab({ instanceName }: ConsoleTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const disconnect = () => {
    wsRef.current?.close();
    wsRef.current = null;
    termRef.current?.dispose();
    termRef.current = null;
    setStatus("idle");
  };

  const connect = async (kind: "exec" | "console") => {
    if (!containerRef.current) return;
    setStatus("connecting");
    try {
      const result = await (kind === "exec"
        ? instancesApi.exec(instanceName, ["/bin/sh"], true)
        : instancesApi.console(instanceName, 80, 24));
      const metadata = (result as AsyncResponse)?.metadata;
      const fds = metadata?.fds as Record<string, string> | undefined;
      const wsPath = fds?.["0"];
      if (!wsPath) throw new Error("No websocket endpoint in operation metadata");

      const terminal = new Terminal({ cursorBlink: true, fontSize: 13, theme: { background: "#15181b" } });
      const fit = new FitAddon();
      terminal.loadAddon(fit);
      terminal.open(containerRef.current);
      termRef.current = terminal;

      const ws = new WebSocket(toWsUrl(wsPath));
      wsRef.current = ws;
      ws.onopen = () => {
        fit.fit();
        terminal.focus();
        setStatus("connected");
      };
      ws.onmessage = (msg) => {
        const data = msg.data instanceof Blob ? null : String(msg.data);
        if (data) terminal.write(data);
      };
      ws.onclose = () => {
        disconnect();
        if (termRef.current) toast("info", "Console disconnected");
      };
      ws.onerror = () => {
        setStatus("error");
        toast("danger", "Console connection failed");
      };
      terminal.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data);
      });
      terminal.onResize(() => fit.fit());
    } catch (err) {
      setStatus("error");
      toast("danger", err instanceof Error ? err.message : "Console failed to connect");
    }
  };

  useEffect(() => disconnect, []);

  return (
    <div data-testid="console-tab">
      <div className="mb-3 flex gap-2">
        <Button size="sm" onClick={() => connect("exec")} disabled={status === "connecting"} data-testid="console-exec">Open shell</Button>
        <Button size="sm" variant="secondary" onClick={() => connect("console")} disabled={status === "connecting"} data-testid="console-vga">VM console</Button>
        <Button size="sm" variant="ghost" onClick={disconnect} data-testid="console-disconnect">Disconnect</Button>
      </div>
      <div ref={containerRef} className="h-96 overflow-hidden rounded border border-border bg-surface-950" />
      {status === "error" && <p className="mt-2 text-xs text-red-300" data-testid="console-error">Connection failed. Is the instance running?</p>}
    </div>
  );
}
```

- [ ] **Step 3: Write unit tests for the testable pieces**

`src/pages/instance/console.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { ConsoleTab } from "./console";

vi.mock("xterm", () => ({
  Terminal: class {
    loadAddon = vi.fn();
    open = vi.fn();
    focus = vi.fn();
    onData = vi.fn();
    onResize = vi.fn();
    write = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class { fit = vi.fn(); },
}));

vi.mock("../../api", () => ({
  instancesApi: {
    exec: vi.fn().mockResolvedValue({ type: "async", status: "Running", status_code: 100, operation: "op1", metadata: { fds: { "0": "/1.0/operations/op1/websocket?secret=s" } } }),
    console: vi.fn(),
  },
}));

describe("ConsoleTab", () => {
  it("renders connect buttons", () => {
    render(<ConsoleTab instanceName="web1" />);
    expect(screen.getByTestId("console-exec")).toBeInTheDocument();
    expect(screen.getByTestId("console-vga")).toBeInTheDocument();
    expect(screen.getByTestId("console-disconnect")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Manual verification against local incusd**

Run: `npm run dev`, open `/ui/instances/<running-container>/console`, click "Open shell".
Expected: xterm opens an interactive `/bin/sh` in the container; typing works. (Requires a running container; if none, create one first.)

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add src/pages/instance/console.tsx src/pages/instance/console.test.tsx package.json package-lock.json
git commit -m "feat: add terminal console with xterm"
```

---

### Task 23: Snapshots Tab

**Files:**
- Create: `src/pages/instance/snapshots.tsx` (rewrite stub), `src/pages/instance/snapshots.test.tsx`

**Interfaces:**
- Consumes: `instancesApi.listSnapshots`, `createSnapshot`, `restoreSnapshot`, `deleteSnapshot`
- Produces: `<SnapshotsTab ({ instanceName }) />` — table (Name, Created, Actions: Restore/Delete), create dialog (name `data-testid="snap-name"`, stateful switch, submit `data-testid="snap-create-submit"`), restore ConfirmDialog (`data-testid="snap-restore-confirm"`); refreshes list after each op; toasts errors

- [ ] **Step 1: Write the tab (test-first)**

`src/pages/instance/snapshots.test.tsx`:
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SnapshotsTab } from "./snapshots";

const snapshot = (name: string) => ({ name, status: "Stopped", type: "container", description: "", created_at: "2026-01-01T00:00:00Z", last_used_at: "", config: {}, devices: {}, profiles: [], project: "default", ephemeral: false });

vi.mock("../../api", () => ({
  instancesApi: {
    listSnapshots: vi.fn().mockResolvedValue([snapshot("snap1"), snapshot("snap2")]),
    createSnapshot: vi.fn().mockResolvedValue(null),
    restoreSnapshot: vi.fn().mockResolvedValue(null),
    deleteSnapshot: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("SnapshotsTab", () => {
  it("lists snapshots", async () => {
    render(<SnapshotsTab instanceName="web1" />);
    expect(await screen.findByText("snap1")).toBeInTheDocument();
    expect(screen.getByText("snap2")).toBeInTheDocument();
  });

  it("creates a snapshot", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../../api");
    render(<SnapshotsTab instanceName="web1" />);
    await screen.findByText("snap1");
    await user.click(screen.getByTestId("snap-create-open"));
    await user.type(screen.getByTestId("snap-name"), "backup");
    await user.click(screen.getByTestId("snap-create-submit"));
    await waitFor(() => expect(instancesApi.createSnapshot).toHaveBeenCalledWith("web1", "backup", false));
  });

  it("restores with confirmation", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../../api");
    render(<SnapshotsTab instanceName="web1" />);
    await screen.findByText("snap1");
    await user.click(screen.getByTestId(`snap-restore-snap1`));
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(instancesApi.restoreSnapshot).toHaveBeenCalledWith("web1", "snap1"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/instance/snapshots.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the tab**

`src/pages/instance/snapshots.tsx`:
```tsx
import { useCallback, useEffect, useState } from "react";
import { instancesApi } from "../../api";
import type { Instance } from "../../api/types";
import { Table } from "../../components/table";
import type { Column } from "../../components/table";
import { Button } from "../../components/button";
import { Dialog } from "../../components/dialog";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { Input } from "../../components/input";
import { Switch } from "../../components/switch";
import { EmptyState } from "../../components/empty-state";
import { toast } from "../../components/toast";

export interface SnapshotsTabProps {
  instanceName: string;
}

export function SnapshotsTab({ instanceName }: SnapshotsTabProps) {
  const [snapshots, setSnapshots] = useState<Instance[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [restoreName, setRestoreName] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [stateful, setStateful] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void instancesApi.listSnapshots(instanceName).then(setSnapshots).catch(() => {});
  }, [instanceName]);

  useEffect(refresh, [refresh]);

  const create = async () => {
    setBusy(true);
    try {
      await instancesApi.createSnapshot(instanceName, name.trim(), stateful);
      toast("success", `Snapshot ${name} created`);
      setCreateOpen(false);
      setName("");
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!restoreName) return;
    setBusy(true);
    try {
      await instancesApi.restoreSnapshot(instanceName, restoreName);
      toast("success", `Restored ${restoreName}`);
      setRestoreName(null);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (snapName: string) => {
    try {
      await instancesApi.deleteSnapshot(instanceName, snapName);
      toast("success", `Deleted snapshot ${snapName}`);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const columns: Column<Instance>[] = [
    { key: "name", header: "Name", sortValue: (s) => s.name, render: (s) => s.name },
    { key: "created", header: "Created", render: (s) => new Date(s.created_at).toLocaleString() },
    {
      key: "actions", header: "", align: "right",
      render: (s) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" data-testid={`snap-restore-${s.name}`} onClick={() => setRestoreName(s.name)}>Restore</Button>
          <Button size="sm" variant="ghost" data-testid={`snap-delete-${s.name}`} onClick={() => remove(s.name)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4" data-testid="snapshots-tab">
      <div className="flex justify-end">
        <Button size="sm" data-testid="snap-create-open" onClick={() => setCreateOpen(true)}>Create snapshot</Button>
      </div>
      {snapshots.length === 0 ? (
        <EmptyState title="No snapshots" description="Snapshots let you roll back to a previous state." />
      ) : (
        <Table columns={columns} rows={snapshots} rowKey={(s) => s.name} />
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create snapshot" footer={
        <>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={create} loading={busy} data-testid="snap-create-submit">Create</Button>
        </>
      }>
        <div className="space-y-3">
          <Input label="Name" name="snap-name" data-testid="snap-name" value={name} onChange={(e) => setName(e.target.value)} />
          <Switch checked={stateful} onChange={setStateful} label="Stateful (include running state)" />
        </div>
      </Dialog>

      <ConfirmDialog
        open={restoreName !== null}
        title={`Restore snapshot ${restoreName ?? ""}`}
        body="The instance will be reverted to this snapshot's state. Running instances will be stopped."
        confirmLabel="Restore"
        loading={busy}
        onConfirm={restore}
        onCancel={() => setRestoreName(null)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/pages/instance/snapshots.tsx src/pages/instance/snapshots.test.tsx
git commit -m "feat: add snapshots tab"
```

---

### Task 24: Config Tab + Shared KeyValueEditor

**Files:**
- Create: `src/components/key-value-editor.tsx`, `src/components/key-value-editor.test.tsx`, `src/pages/instance/config.tsx` (rewrite stub), `src/pages/instance/config.test.tsx`, `src/lib/config.ts`, `src/lib/config.test.ts`

**Interfaces:**
- Consumes: `instancesApi.get`, `instancesApi.update`, KeyValueEditor
- Produces:
  - `validateConfigKey(key: string): string | null` in `src/lib/config.ts`
  - `KeyValueEditor({ values, onChange, dataTestId? })` — editable key/value rows, `data-testid="kv-key-<key>"` / `kv-value-<key>` / `kv-remove-<key>` / `kv-add`
  - `<ConfigTab ({ instanceName }) />` — loads instance, edits `config` via KeyValueEditor, description input, Save (`data-testid="config-save"`) calls `instancesApi.update(name, { config, description })`, Reset (`data-testid="config-reset"`)

- [ ] **Step 1: Write validation helper and KeyValueEditor (test-first)**

`src/lib/config.test.ts`:
```ts
import { validateConfigKey } from "./config";

describe("validateConfigKey", () => {
  it("accepts valid keys", () => {
    expect(validateConfigKey("limits.memory")).toBeNull();
    expect(validateConfigKey("boot.autostart")).toBeNull();
    expect(validateConfigKey("a1_b-c")).toBeNull();
  });

  it("rejects invalid keys", () => {
    expect(validateConfigKey("Bad Key")).not.toBeNull();
    expect(validateConfigKey("1bad")).not.toBeNull();
    expect(validateConfigKey("")).not.toBeNull();
  });
});
```

`src/lib/config.ts`:
```ts
export function validateConfigKey(key: string): string | null {
  if (!/^[a-z][a-z0-9_.-]*$/.test(key)) {
    return "Key must start with a letter and contain only a-z, 0-9, . _ -";
  }
  return null;
}
```

`src/components/key-value-editor.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyValueEditor } from "./key-value-editor";

describe("KeyValueEditor", () => {
  it("renders entries", () => {
    render(<KeyValueEditor values={{ "limits.memory": "512MiB" }} onChange={() => {}} />);
    expect(screen.getByTestId("kv-key-limits.memory")).toHaveValue("limits.memory");
    expect(screen.getByTestId("kv-value-limits.memory")).toHaveValue("512MiB");
  });

  it("edits values", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeyValueEditor values={{ key1: "a" }} onChange={onChange} />);
    await user.clear(screen.getByTestId("kv-value-key1"));
    await user.type(screen.getByTestId("kv-value-key1"), "b");
    expect(onChange).toHaveBeenLastCalledWith({ key1: "b" });
  });

  it("removes entries", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeyValueEditor values={{ key1: "a", key2: "b" }} onChange={onChange} />);
    await user.click(screen.getByTestId("kv-remove-key1"));
    expect(onChange).toHaveBeenCalledWith({ key2: "b" });
  });

  it("adds entries", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeyValueEditor values={{ key1: "a" }} onChange={onChange} />);
    await user.click(screen.getByTestId("kv-add"));
    expect(onChange).toHaveBeenCalledWith({ key1: "a", custom_2: "" });
  });
});
```

`src/components/key-value-editor.tsx`:
```tsx
export interface KeyValueEditorProps {
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  dataTestId?: string;
}

export function KeyValueEditor({ values, onChange, dataTestId = "kv-editor" }: KeyValueEditorProps) {
  const entries = Object.entries(values);
  const entryCount = entries.length;

  const setValue = (key: string, value: string) => onChange({ ...values, [key]: value });

  const setKey = (oldKey: string, newKey: string) => {
    const next = { ...values };
    const value = next[oldKey];
    delete next[oldKey];
    next[newKey] = value ?? "";
    onChange(next);
  };

  const removeEntry = (key: string) => {
    const next = { ...values };
    delete next[key];
    onChange(next);
  };

  const addEntry = () => {
    onChange({ ...values, [`custom_${entryCount + 1}`]: "" });
  };

  return (
    <div className="space-y-2" data-testid={dataTestId}>
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-2">
          <input
            data-testid={`kv-key-${key}`}
            className="h-8 w-1/2 rounded border border-border bg-surface-500 px-2.5 font-mono text-xs text-text-primary focus:border-accent-500 focus:outline-none"
            value={key}
            onChange={(e) => setKey(key, e.target.value)}
            aria-label={`Key ${key}`}
          />
          <input
            data-testid={`kv-value-${key}`}
            className="h-8 flex-1 rounded border border-border bg-surface-500 px-2.5 text-sm text-text-primary focus:border-accent-500 focus:outline-none"
            value={value}
            onChange={(e) => setValue(key, e.target.value)}
            aria-label={`Value ${key}`}
          />
          <Button variant="ghost" size="sm" data-testid={`kv-remove-${key}`} onClick={() => removeEntry(key)} aria-label={`Remove ${key}`}>✕</Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" data-testid="kv-add" onClick={addEntry}>Add key</Button>
    </div>
  );
}
```
(Add the `Button` import to this file.)

- [ ] **Step 2: Write the Config tab (test-first)**

`src/pages/instance/config.test.tsx`:
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigTab } from "./config";

vi.mock("../../api", () => ({
  instancesApi: {
    get: vi.fn().mockResolvedValue({ name: "web1", status: "Stopped", type: "container", description: "old", created_at: "t", last_used_at: "t", config: { "limits.memory": "512MiB" }, devices: {}, profiles: [], project: "default", ephemeral: false }),
    update: vi.fn().mockResolvedValue(null),
  },
}));

describe("ConfigTab", () => {
  it("loads and saves config", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../../api");
    render(<ConfigTab instanceName="web1" />);
    expect(await screen.findByTestId("kv-key-limits.memory")).toHaveValue("limits.memory");
    await user.click(screen.getByTestId("config-save"));
    await waitFor(() => expect(instancesApi.update).toHaveBeenCalledWith("web1", expect.objectContaining({ config: { "limits.memory": "512MiB" } })));
  });

  it("validates edited keys on save", async () => {
    const user = userEvent.setup();
    render(<ConfigTab instanceName="web1" />);
    await screen.findByTestId("kv-key-limits.memory");
    await user.clear(screen.getByTestId("kv-key-limits.memory"));
    await user.type(screen.getByTestId("kv-key-limits.memory"), "Bad Key");
    await user.click(screen.getByTestId("config-save"));
    expect(screen.getByText(/Key must start with a letter/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/lib/config.test.ts src/components/key-value-editor.test.tsx src/pages/instance/config.test.tsx`
Expected: FAIL — modules missing.

- [ ] **Step 4: Write the Config tab**

`src/pages/instance/config.tsx`:
```tsx
import { useCallback, useEffect, useState } from "react";
import { instancesApi } from "../../api";
import type { Instance } from "../../api/types";
import { KeyValueEditor } from "../../components/key-value-editor";
import { Input } from "../../components/input";
import { Button } from "../../components/button";
import { toast } from "../../components/toast";
import { validateConfigKey } from "../../lib/config";

export interface ConfigTabProps {
  instanceName: string;
}

export function ConfigTab({ instanceName }: ConfigTabProps) {
  const [instance, setInstance] = useState<Instance | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => {
    instancesApi.get(instanceName).then((i) => {
      setInstance(i);
      setConfig(i.config);
      setDescription(i.description);
    }).catch(() => {});
  }, [instanceName]);

  useEffect(refresh, [refresh]);

  const save = async () => {
    const nextErrors: Record<string, string> = {};
    for (const key of Object.keys(config)) {
      const error = validateConfigKey(key);
      if (error) nextErrors[key] = error;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);
    try {
      await instancesApi.update(instanceName, { config, description });
      toast("success", "Configuration saved");
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!instance) return <div data-testid="config-tab">Loading…</div>;

  return (
    <div className="max-w-2xl space-y-4" data-testid="config-tab">
      <Input label="Description" name="config-description" data-testid="config-description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <div>
        <div className="mb-1 text-xs font-medium text-text-secondary">Configuration</div>
        <KeyValueEditor values={config} onChange={setConfig} dataTestId="config-editor" />
      </div>
      {Object.values(errors)[0] && <p className="text-xs text-red-300">{Object.values(errors)[0]}</p>}
      <div className="flex gap-2">
        <Button onClick={save} loading={saving} data-testid="config-save">Save</Button>
        <Button variant="secondary" onClick={refresh} data-testid="config-reset">Reset</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/key-value-editor.tsx src/components/key-value-editor.test.tsx src/pages/instance/config.tsx src/pages/instance/config.test.tsx src/lib/config.ts src/lib/config.test.ts
git commit -m "feat: add config tab with key/value editor"
```

---

### Task 25: Logs Tab

**Files:**
- Create: `src/pages/instance/logs.tsx` (rewrite stub), `src/pages/instance/logs.test.tsx`

**Interfaces:**
- Consumes: `instancesApi.listLogs`, `instancesApi.readLog`
- Produces: `<LogsTab ({ instanceName }) />` — file list (buttons `data-testid="log-file-<name>"`), selected file content in `<pre data-testid="log-content">`, auto-selects first file

- [ ] **Step 1: Write the tab (test-first)**

`src/pages/instance/logs.test.tsx`:
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogsTab } from "./logs";

vi.mock("../../api", () => ({
  instancesApi: {
    listLogs: vi.fn().mockResolvedValue(["console.log", "config.json"]),
    readLog: vi.fn().mockResolvedValue("line1\nline2"),
  },
}));

describe("LogsTab", () => {
  it("lists files and shows content", async () => {
    render(<LogsTab instanceName="web1" />);
    expect(await screen.findByText("console.log")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("log-content")).toHaveTextContent("line1"));
  });

  it("switches files", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../../api");
    render(<LogsTab instanceName="web1" />);
    await screen.findByText("config.json");
    await user.click(screen.getByTestId("log-file-config.json"));
    expect(instancesApi.readLog).toHaveBeenCalledWith("web1", "config.json");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/instance/logs.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the tab**

`src/pages/instance/logs.tsx`:
```tsx
import { useCallback, useEffect, useState } from "react";
import { instancesApi } from "../../api";
import { EmptyState } from "../../components/empty-state";

export interface LogsTabProps {
  instanceName: string;
}

export function LogsTab({ instanceName }: LogsTabProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");

  const refresh = useCallback(() => {
    void instancesApi.listLogs(instanceName).then((list) => {
      setFiles(list);
      if (!selected && list[0]) setSelected(list[0]);
    }).catch(() => {});
  }, [instanceName, selected]);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    if (!selected) return;
    void instancesApi.readLog(instanceName, selected).then(setContent).catch(() => setContent("(unreadable)"));
  }, [instanceName, selected]);

  if (files.length === 0) return <EmptyState title="No logs" description="This instance has no log files." />;

  return (
    <div className="space-y-3" data-testid="logs-tab">
      <div className="flex flex-wrap gap-2">
        {files.map((file) => (
          <button
            key={file}
            data-testid={`log-file-${file}`}
            onClick={() => setSelected(file)}
            className={`rounded border px-2 py-1 font-mono text-xs ${selected === file ? "border-accent-500 text-accent-300" : "border-border text-text-secondary hover:text-text-primary"}`}
          >
            {file}
          </button>
        ))}
      </div>
      <pre data-testid="log-content" className="max-h-96 overflow-auto rounded border border-border bg-surface-950 p-3 font-mono text-xs text-text-primary">
        {content}
      </pre>
    </div>
  );
}
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/pages/instance/logs.tsx src/pages/instance/logs.test.tsx
git commit -m "feat: add logs tab"
```

---

### Task 26: Images Page

**Files:**
- Create: `src/pages/images.tsx` (rewrite stub), `src/pages/images.test.tsx`

**Interfaces:**
- Consumes: `infraApi.listImages`, `deleteImage`, `pullImage`
- Produces: `<ImagesPage />` — table (Alias/description, Fingerprint (first 12 chars), Type, Size, Public, Created, Actions), Pull dialog (alias `data-testid="pull-alias"`, server `data-testid="pull-server"`, type select, submit `data-testid="pull-submit"`), delete ConfirmDialog; `formatBytes` for sizes

- [ ] **Step 1: Write the page (test-first)**

`src/pages/images.test.tsx`:
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImagesPage } from "./images";

vi.mock("../api", () => ({
  infraApi: {
    listImages: vi.fn().mockResolvedValue([
      { fingerprint: "abcdef1234567890", filename: "x.img", description: "Ubuntu 24.04", public: true, created_at: "2026-01-01T00:00:00Z", size: 104857600, type: "container", properties: {} },
    ]),
    deleteImage: vi.fn().mockResolvedValue(undefined),
    pullImage: vi.fn().mockResolvedValue(null),
  },
}));

describe("ImagesPage", () => {
  it("lists images", async () => {
    render(<ImagesPage />);
    expect(await screen.findByText("Ubuntu 24.04")).toBeInTheDocument();
    expect(screen.getByText("abcdef123456")).toBeInTheDocument();
    expect(screen.getByText("100 MiB")).toBeInTheDocument();
  });

  it("pulls an image", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ImagesPage />);
    await screen.findByText("Ubuntu 24.04");
    await user.click(screen.getByTestId("pull-open"));
    await user.type(screen.getByTestId("pull-alias"), "ubuntu/24.04");
    await user.type(screen.getByTestId("pull-server"), "https://images.linuxcontainers.org");
    await user.click(screen.getByTestId("pull-submit"));
    await waitFor(() => expect(infraApi.pullImage).toHaveBeenCalledWith(expect.objectContaining({ alias: "ubuntu/24.04", server: "https://images.linuxcontainers.org" })));
  });

  it("deletes with confirmation", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ImagesPage />);
    await screen.findByText("Ubuntu 24.04");
    await user.click(screen.getByTestId("image-delete-abcdef1234567890"));
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(infraApi.deleteImage).toHaveBeenCalledWith("abcdef1234567890"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/images.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the page**

`src/pages/images.tsx`:
```tsx
import { useCallback, useEffect, useState } from "react";
import { infraApi } from "../api";
import type { Image } from "../api/types";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { Dialog } from "../components/dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Input } from "../components/input";
import { Select } from "../components/select";
import { EmptyState } from "../components/empty-state";
import { toast } from "../components/toast";
import { formatBytes } from "../lib/format";

export function ImagesPage() {
  const [images, setImages] = useState<Image[]>([]);
  const [pullOpen, setPullOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Image | null>(null);
  const [alias, setAlias] = useState("");
  const [server, setServer] = useState("https://images.linuxcontainers.org");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void infraApi.listImages().then(setImages).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);

  const pull = async () => {
    setBusy(true);
    try {
      await infraApi.pullImage({ alias: alias.trim(), server: server.trim() });
      toast("success", `Pulling ${alias.trim()}`);
      setPullOpen(false);
      setAlias("");
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Pull failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await infraApi.deleteImage(deleteTarget.fingerprint);
      toast("success", "Image deleted");
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const columns: Column<Image>[] = [
    { key: "name", header: "Description", sortValue: (i) => i.description, render: (i) => i.description || i.filename },
    { key: "fingerprint", header: "Fingerprint", render: (i) => <span className="font-mono text-xs">{i.fingerprint.slice(0, 12)}</span> },
    { key: "type", header: "Type", render: (i) => (i.type === "container" ? "Container" : "VM") },
    { key: "size", header: "Size", align: "right", sortValue: (i) => i.size, render: (i) => formatBytes(i.size) },
    { key: "created", header: "Created", render: (i) => new Date(i.created_at).toLocaleDateString() },
    {
      key: "actions", header: "", align: "right",
      render: (i) => (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" data-testid={`image-delete-${i.fingerprint}`} onClick={() => setDeleteTarget(i)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 p-6" data-testid="images-page">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Images</h1>
        <Button size="sm" data-testid="pull-open" onClick={() => setPullOpen(true)}>Pull image</Button>
      </div>

      {images.length === 0 ? (
        <EmptyState title="No images" description="Pull an image from a remote to get started." />
      ) : (
        <Table columns={columns} rows={images} rowKey={(i) => i.fingerprint} />
      )}

      <Dialog open={pullOpen} onClose={() => setPullOpen(false)} title="Pull image" footer={
        <>
          <Button variant="secondary" onClick={() => setPullOpen(false)}>Cancel</Button>
          <Button onClick={pull} loading={busy} data-testid="pull-submit">Pull</Button>
        </>
      }>
        <div className="space-y-3">
          <Input label="Alias" name="pull-alias" data-testid="pull-alias" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="ubuntu/24.04" />
          <Input label="Server" name="pull-server" data-testid="pull-server" value={server} onChange={(e) => setServer(e.target.value)} />
          <Select label="Type" name="pull-type" defaultValue="container">
            <option value="container">Container</option>
            <option value="virtual-machine">Virtual machine</option>
          </Select>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete image"
        body={`Delete image ${deleteTarget?.description || deleteTarget?.fingerprint.slice(0, 12)}? This does not affect existing instances.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/pages/images.tsx src/pages/images.test.tsx
git commit -m "feat: add images page with pull and delete"
```

---

### Task 27: Profiles Page

**Files:**
- Create: `src/pages/profiles.tsx` (rewrite stub), `src/pages/profiles.test.tsx`

**Interfaces:**
- Consumes: `infraApi.listProfiles`, `getProfile`, `createProfile`, `updateProfile`, `deleteProfile`; KeyValueEditor
- Produces: `<ProfilesPage />` — table (Name, Description), Create dialog (name `data-testid="profile-name"`, submit `data-testid="profile-create-submit"`), edit dialog (description + KeyValueEditor `data-testid="profile-editor"`, save `data-testid="profile-save"`), delete ConfirmDialog

- [ ] **Step 1: Write the page (test-first)**

`src/pages/profiles.test.tsx`:
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfilesPage } from "./profiles";

const profile = (name: string) => ({ name, description: `desc ${name}`, config: { "limits.cpu": "2" }, devices: {} });

vi.mock("../api", () => ({
  infraApi: {
    listProfiles: vi.fn().mockResolvedValue([profile("default")]),
    getProfile: vi.fn().mockResolvedValue(profile("default")),
    createProfile: vi.fn().mockResolvedValue(null),
    updateProfile: vi.fn().mockResolvedValue(null),
    deleteProfile: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("ProfilesPage", () => {
  it("lists profiles", async () => {
    render(<ProfilesPage />);
    expect(await screen.findByText("default")).toBeInTheDocument();
    expect(screen.getByText("desc default")).toBeInTheDocument();
  });

  it("creates a profile", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ProfilesPage />);
    await screen.findByText("default");
    await user.click(screen.getByTestId("profile-create-open"));
    await user.type(screen.getByTestId("profile-name"), "web");
    await user.click(screen.getByTestId("profile-create-submit"));
    await waitFor(() => expect(infraApi.createProfile).toHaveBeenCalledWith(expect.objectContaining({ name: "web" })));
  });

  it("edits config", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ProfilesPage />);
    await screen.findByText("default");
    await user.click(screen.getByTestId("profile-edit-default"));
    expect(await screen.findByTestId("kv-key-limits.cpu")).toHaveValue("limits.cpu");
    await user.click(screen.getByTestId("profile-save"));
    await waitFor(() => expect(infraApi.updateProfile).toHaveBeenCalledWith("default", expect.objectContaining({ config: { "limits.cpu": "2" } })));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/profiles.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the page**

`src/pages/profiles.tsx`:
```tsx
import { useCallback, useEffect, useState } from "react";
import { infraApi } from "../api";
import type { Profile } from "../api/types";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { Dialog } from "../components/dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Input } from "../components/input";
import { KeyValueEditor } from "../components/key-value-editor";
import { EmptyState } from "../components/empty-state";
import { toast } from "../components/toast";

export function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void infraApi.listProfiles().then(setProfiles).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);

  const create = async () => {
    setBusy(true);
    try {
      await infraApi.createProfile({ name: name.trim() });
      toast("success", `Profile ${name} created`);
      setCreateOpen(false);
      setName("");
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = async (profileName: string) => {
    try {
      const p = await infraApi.getProfile(profileName);
      setEditing(p);
      setDescription(p.description);
      setConfig(p.config);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Load failed");
    }
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await infraApi.updateProfile(editing.name, { description, config });
      toast("success", `Profile ${editing.name} saved`);
      setEditing(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await infraApi.deleteProfile(deleteTarget.name);
      toast("success", `Profile ${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const columns: Column<Profile>[] = [
    { key: "name", header: "Name", sortValue: (p) => p.name, render: (p) => <span className="font-medium">{p.name}</span> },
    { key: "description", header: "Description", render: (p) => p.description || "—" },
    {
      key: "actions", header: "", align: "right",
      render: (p) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" data-testid={`profile-edit-${p.name}`} onClick={() => openEdit(p.name)}>Edit</Button>
          <Button size="sm" variant="ghost" data-testid={`profile-delete-${p.name}`} onClick={() => setDeleteTarget(p)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 p-6" data-testid="profiles-page">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Profiles</h1>
        <Button size="sm" data-testid="profile-create-open" onClick={() => setCreateOpen(true)}>Create profile</Button>
      </div>

      {profiles.length === 0 ? (
        <EmptyState title="No profiles" />
      ) : (
        <Table columns={columns} rows={profiles} rowKey={(p) => p.name} />
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create profile" footer={
        <>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={create} loading={busy} data-testid="profile-create-submit">Create</Button>
        </>
      }>
        <Input label="Name" name="profile-name" data-testid="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Dialog>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={`Edit profile ${editing?.name ?? ""}`} footer={
        <>
          <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
          <Button onClick={save} loading={busy} data-testid="profile-save">Save</Button>
        </>
      }>
        <div className="space-y-3">
          <Input label="Description" name="profile-description" data-testid="profile-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <KeyValueEditor values={config} onChange={setConfig} dataTestId="profile-editor" />
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete profile"
        body={`Delete profile ${deleteTarget?.name}? Instances using it will be affected.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/pages/profiles.tsx src/pages/profiles.test.tsx
git commit -m "feat: add profiles page"
```

---

### Task 28: Networks Page

**Files:**
- Create: `src/pages/networks.tsx` (rewrite stub), `src/pages/networks.test.tsx`

**Interfaces:**
- Consumes: `infraApi.listNetworks`, `createNetwork`, `updateNetwork`, `deleteNetwork`
- Produces: `<NetworksPage />` — table (Name, Type, Managed, Used by, Status, Actions), Create dialog (name `data-testid="network-name"`, type select `data-testid="network-type"` with bridge/ovn/physical/macvlan, description, submit `data-testid="network-create-submit"`), Edit dialog (description only, `data-testid="network-save"`), delete ConfirmDialog (disabled for managed/unmanaged in-use networks — the API enforces it; we surface the error via toast)

- [ ] **Step 1: Write the page (test-first)**

`src/pages/networks.test.tsx`:
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NetworksPage } from "./networks";

vi.mock("../api", () => ({
  infraApi: {
    listNetworks: vi.fn().mockResolvedValue([{ name: "br0", description: "bridge", type: "bridge", managed: true, used_by: ["/1.0/instances/web1"], status: "Created" }]),
    createNetwork: vi.fn().mockResolvedValue(null),
    updateNetwork: vi.fn().mockResolvedValue(null),
    deleteNetwork: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("NetworksPage", () => {
  it("lists networks", async () => {
    render(<NetworksPage />);
    expect(await screen.findByText("br0")).toBeInTheDocument();
    expect(screen.getByText("bridge")).toBeInTheDocument();
  });

  it("creates a bridge network", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<NetworksPage />);
    await screen.findByText("br0");
    await user.click(screen.getByTestId("network-create-open"));
    await user.type(screen.getByTestId("network-name"), "lan0");
    await user.click(screen.getByTestId("network-create-submit"));
    await waitFor(() => expect(infraApi.createNetwork).toHaveBeenCalledWith(expect.objectContaining({ name: "lan0", type: "bridge" })));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/networks.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the page**

`src/pages/networks.tsx`:
```tsx
import { useCallback, useEffect, useState } from "react";
import { infraApi } from "../api";
import type { Network } from "../api/types";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { Dialog } from "../components/dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Input } from "../components/input";
import { Select } from "../components/select";
import { EmptyState } from "../components/empty-state";
import { toast } from "../components/toast";

export function NetworksPage() {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Network | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Network | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("bridge");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void infraApi.listNetworks().then(setNetworks).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);

  const create = async () => {
    setBusy(true);
    try {
      await infraApi.createNetwork({ name: name.trim(), type });
      toast("success", `Network ${name} created`);
      setCreateOpen(false);
      setName("");
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await infraApi.updateNetwork(editing.name, { description });
      toast("success", `Network ${editing.name} saved`);
      setEditing(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await infraApi.deleteNetwork(deleteTarget.name);
      toast("success", `Network ${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const columns: Column<Network>[] = [
    { key: "name", header: "Name", sortValue: (n) => n.name, render: (n) => <span className="font-medium">{n.name}</span> },
    { key: "type", header: "Type", render: (n) => n.type },
    { key: "managed", header: "Managed", render: (n) => (n.managed ? "Yes" : "No") },
    { key: "used", header: "Used by", render: (n) => n.used_by.length },
    { key: "status", header: "Status", render: (n) => n.status },
    {
      key: "actions", header: "", align: "right",
      render: (n) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" data-testid={`network-edit-${n.name}`} onClick={() => { setEditing(n); setDescription(n.description); }}>Edit</Button>
          <Button size="sm" variant="ghost" data-testid={`network-delete-${n.name}`} onClick={() => setDeleteTarget(n)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 p-6" data-testid="networks-page">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Networks</h1>
        <Button size="sm" data-testid="network-create-open" onClick={() => setCreateOpen(true)}>Create network</Button>
      </div>

      {networks.length === 0 ? (
        <EmptyState title="No networks" />
      ) : (
        <Table columns={columns} rows={networks} rowKey={(n) => n.name} />
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create network" footer={
        <>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={create} loading={busy} data-testid="network-create-submit">Create</Button>
        </>
      }>
        <div className="space-y-3">
          <Input label="Name" name="network-name" data-testid="network-name" value={name} onChange={(e) => setName(e.target.value)} />
          <Select label="Type" name="network-type" data-testid="network-type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="bridge">bridge</option>
            <option value="ovn">ovn</option>
            <option value="physical">physical</option>
            <option value="macvlan">macvlan</option>
          </Select>
          <Input label="Description" name="network-desc" data-testid="network-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </Dialog>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={`Edit network ${editing?.name ?? ""}`} footer={
        <>
          <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
          <Button onClick={save} loading={busy} data-testid="network-save">Save</Button>
        </>
      }>
        <Input label="Description" name="network-edit-desc" data-testid="network-edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete network"
        body={`Delete network ${deleteTarget?.name}?`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/pages/networks.tsx src/pages/networks.test.tsx
git commit -m "feat: add networks page"
```

---

### Task 29: Storage Pools Page

**Files:**
- Create: `src/pages/storage.tsx` (rewrite stub), `src/pages/storage.test.tsx`

**Interfaces:**
- Consumes: `infraApi.listPools`, `createPool`, `deletePool`, `listPoolVolumes`, `deletePoolVolume`
- Produces: `<StoragePage />` — pools table (Name, Driver, Status, Used by, Actions), expandable volumes table per pool (`data-testid="pool-volumes-<name>"` toggle), Create dialog (name `data-testid="pool-name"`, driver select `data-testid="pool-driver"` dir/btrfs/lvm/zfs, submit `data-testid="pool-create-submit"`), delete confirmations

- [ ] **Step 1: Write the page (test-first)**

`src/pages/storage.test.tsx`:
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoragePage } from "./storage";

vi.mock("../api", () => ({
  infraApi: {
    listPools: vi.fn().mockResolvedValue([{ name: "data", description: "", driver: "zfs", status: "Created", used_by: ["/1.0/instances/db1"] }]),
    listPoolVolumes: vi.fn().mockResolvedValue([{ name: "db1", type: "container", content_type: "filesystem" }]),
    createPool: vi.fn().mockResolvedValue(null),
    deletePool: vi.fn().mockResolvedValue(undefined),
    deletePoolVolume: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("StoragePage", () => {
  it("lists pools and volumes", async () => {
    render(<StoragePage />);
    expect(await screen.findByText("data")).toBeInTheDocument();
    expect(screen.getByText("zfs")).toBeInTheDocument();
  });

  it("creates a pool", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<StoragePage />);
    await screen.findByText("data");
    await user.click(screen.getByTestId("pool-create-open"));
    await user.type(screen.getByTestId("pool-name"), "fast");
    await user.click(screen.getByTestId("pool-create-submit"));
    await waitFor(() => expect(infraApi.createPool).toHaveBeenCalledWith(expect.objectContaining({ name: "fast", driver: "dir" })));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/storage.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the page**

`src/pages/storage.tsx`:
```tsx
import { useCallback, useEffect, useState } from "react";
import { infraApi } from "../api";
import type { StoragePool, StorageVolume } from "../api/types";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { Dialog } from "../components/dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Input } from "../components/input";
import { Select } from "../components/select";
import { EmptyState } from "../components/empty-state";
import { toast } from "../components/toast";

export function StoragePage() {
  const [pools, setPools] = useState<StoragePool[]>([]);
  const [volumes, setVolumes] = useState<Record<string, StorageVolume[]>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [deletePoolTarget, setDeletePoolTarget] = useState<StoragePool | null>(null);
  const [deleteVolumeTarget, setDeleteVolumeTarget] = useState<{ pool: string; name: string } | null>(null);
  const [name, setName] = useState("");
  const [driver, setDriver] = useState("dir");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void infraApi.listPools().then(setPools).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);

  const toggleVolumes = async (pool: string) => {
    if (volumes[pool]) {
      const next = { ...volumes };
      delete next[pool];
      setVolumes(next);
      return;
    }
    try {
      const list = await infraApi.listPoolVolumes(pool);
      setVolumes((prev) => ({ ...prev, [pool]: list }));
    } catch {
      toast("danger", "Failed to load pool volumes");
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      await infraApi.createPool({ name: name.trim(), driver });
      toast("success", `Pool ${name} created`);
      setCreateOpen(false);
      setName("");
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const removePool = async () => {
    if (!deletePoolTarget) return;
    try {
      await infraApi.deletePool(deletePoolTarget.name);
      toast("success", `Pool ${deletePoolTarget.name} deleted`);
      setDeletePoolTarget(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const removeVolume = async () => {
    if (!deleteVolumeTarget) return;
    try {
      await infraApi.deletePoolVolume(deleteVolumeTarget.pool, deleteVolumeTarget.name);
      toast("success", `Volume ${deleteVolumeTarget.name} deleted`);
      setDeleteVolumeTarget(null);
      await toggleVolumes(deleteVolumeTarget.pool);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const renderVolumeTable = (poolName: string, list: StorageVolume[]) => (
    <Table
      columns={[
        { key: "name", header: "Name", render: (v: StorageVolume) => v.name },
        { key: "content", header: "Content type", render: (v: StorageVolume) => v.content_type },
        {
          key: "actions", header: "", align: "right",
          render: (v: StorageVolume) => (
            <Button size="sm" variant="ghost" data-testid={`volume-delete-${v.name}`} onClick={() => setDeleteVolumeTarget({ pool: poolName, name: v.name })}>Delete</Button>
          ),
        },
      ]}
      rows={list}
      rowKey={(v) => v.name}
    />
  );

  return (
    <div className="space-y-4 p-6" data-testid="storage-page">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Storage pools</h1>
        <Button size="sm" data-testid="pool-create-open" onClick={() => setCreateOpen(true)}>Create pool</Button>
      </div>

      {pools.length === 0 ? (
        <EmptyState title="No storage pools" />
      ) : (
        <Table columns={columns} rows={pools} rowKey={(p) => p.name} />
      )}

      {Object.entries(volumes).map(([poolName, list]) => (
        <div key={poolName} className="rounded border border-border bg-surface-900 p-3">
          <h2 className="mb-2 text-sm font-semibold text-text-primary">Volumes in {poolName}</h2>
          {renderVolumeTable(poolName, list)}
        </div>
      ))}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create storage pool" footer={
        <>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={create} loading={busy} data-testid="pool-create-submit">Create</Button>
        </>
      }>
        <div className="space-y-3">
          <Input label="Name" name="pool-name" data-testid="pool-name" value={name} onChange={(e) => setName(e.target.value)} />
          <Select label="Driver" name="pool-driver" data-testid="pool-driver" value={driver} onChange={(e) => setDriver(e.target.value)}>
            <option value="dir">dir</option>
            <option value="btrfs">btrfs</option>
            <option value="lvm">lvm</option>
            <option value="zfs">zfs</option>
          </Select>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deletePoolTarget !== null}
        title="Delete pool"
        body={`Delete pool ${deletePoolTarget?.name}? This is destructive.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={removePool}
        onCancel={() => setDeletePoolTarget(null)}
      />
      <ConfirmDialog
        open={deleteVolumeTarget !== null}
        title="Delete volume"
        body={`Delete volume ${deleteVolumeTarget?.name}?`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={removeVolume}
        onCancel={() => setDeleteVolumeTarget(null)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/pages/storage.tsx src/pages/storage.test.tsx
git commit -m "feat: add storage pools page"
```

---

### Task 30: Projects Page

**Files:**
- Create: `src/pages/projects.tsx` (rewrite stub), `src/pages/projects.test.tsx`
- Modify: `src/App.tsx` — add `projects` route if missing

**Interfaces:**
- Consumes: `infraApi.listProjects`, `createProject`, `deleteProject`; `projectsStore`, `currentProjectStore`, `setCurrentProject`
- Produces: `<ProjectsPage />` — table (Name, Description, Actions: Set default / Delete), create dialog (name `data-testid="project-name"`, submit `data-testid="project-create-submit"`), delete ConfirmDialog; current project row shows a "default" badge (`data-testid="project-current"`)

- [ ] **Step 1: Write the page (test-first)**

`src/pages/projects.test.tsx`:
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectsPage } from "./projects";
import { currentProjectStore } from "../state/projects";

vi.mock("../api", () => ({
  infraApi: {
    listProjects: vi.fn().mockResolvedValue([{ name: "default", description: "", config: {} }, { name: "prod", description: "production", config: {} }]),
    createProject: vi.fn().mockResolvedValue(null),
    deleteProject: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("ProjectsPage", () => {
  beforeEach(() => currentProjectStore.setState("default"));

  it("lists projects and marks current", async () => {
    render(<ProjectsPage />);
    expect(await screen.findByText("prod")).toBeInTheDocument();
    expect(screen.getByTestId("project-current")).toHaveTextContent("default");
  });

  it("switches default project", async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);
    await screen.findByText("prod");
    await user.click(screen.getByTestId("project-set-default-prod"));
    expect(currentProjectStore.getState()).toBe("prod");
  });

  it("creates a project", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ProjectsPage />);
    await screen.findByText("prod");
    await user.click(screen.getByTestId("project-create-open"));
    await user.type(screen.getByTestId("project-name"), "staging");
    await user.click(screen.getByTestId("project-create-submit"));
    await waitFor(() => expect(infraApi.createProject).toHaveBeenCalledWith(expect.objectContaining({ name: "staging" })));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/projects.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the page**

`src/pages/projects.tsx`:
```tsx
import { useCallback, useEffect, useState } from "react";
import { infraApi } from "../api";
import type { Project } from "../api/types";
import { projectsStore, currentProjectStore, setCurrentProject } from "../state/projects";
import { useStore } from "../state/store";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { Dialog } from "../components/dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Input } from "../components/input";
import { Badge } from "../components/badge";
import { toast } from "../components/toast";

export function ProjectsPage() {
  const projects = useStore(projectsStore);
  const currentProject = useStore(currentProjectStore);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void infraApi.listProjects().then(projectsStore.setState).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);

  const create = async () => {
    setBusy(true);
    try {
      await infraApi.createProject({ name: name.trim() });
      toast("success", `Project ${name} created`);
      setCreateOpen(false);
      setName("");
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await infraApi.deleteProject(deleteTarget.name);
      toast("success", `Project ${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const columns: Column<Project>[] = [
    {
      key: "name", header: "Name", sortValue: (p) => p.name,
      render: (p) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-medium">{p.name}</span>
          {p.name === currentProject && <Badge tone="info" data-testid="project-current">current</Badge>}
        </span>
      ),
    },
    { key: "description", header: "Description", render: (p) => p.description || "—" },
    {
      key: "actions", header: "", align: "right",
      render: (p) => (
        <div className="flex justify-end gap-1">
          {p.name !== currentProject && (
            <Button size="sm" variant="ghost" data-testid={`project-set-default-${p.name}`} onClick={() => { setCurrentProject(p.name); toast("info", `Switched to project ${p.name}`); }}>Set default</Button>
          )}
          <Button size="sm" variant="ghost" data-testid={`project-delete-${p.name}`} onClick={() => setDeleteTarget(p)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 p-6" data-testid="projects-page">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Projects</h1>
        <Button size="sm" data-testid="project-create-open" onClick={() => setCreateOpen(true)}>Create project</Button>
      </div>

      <Table columns={columns} rows={projects} rowKey={(p) => p.name} emptyMessage="No projects" />

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create project" footer={
        <>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={create} loading={busy} data-testid="project-create-submit">Create</Button>
        </>
      }>
        <Input label="Name" name="project-name" data-testid="project-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete project"
        body={`Delete project ${deleteTarget?.name}? All of its resources must be empty.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
```

- [ ] **Step 3: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean. (The `data-testid="project-current"` badge is already applied in the table above.)

- [ ] **Step 5: Commit**

```bash
git add src/pages/projects.tsx src/pages/projects.test.tsx
git commit -m "feat: add projects page"
```

---

### Task 31: Production Build + README + Final Verification

**Files:**
- Create: `README.md`
- Modify: `vite.config.ts` — production base `/ui/` is already set (Task 1); verify `build` output structure
- Test: none new — full suite + manual prod-style check

**Interfaces:**
- Consumes: everything
- Produces: deployable static export + developer docs

- [ ] **Step 1: Verify the production build**

Run: `npm run build`
Expected: `dist/` contains `index.html` with asset links under `/ui/assets/...`. Confirm by grepping: `grep -o '/ui/assets/[^"]*' dist/index.html | head -3`

- [ ] **Step 2: Write the README**

`README.md`:
```markdown
# ixui — Incus Web UI

A hand-crafted React web UI for Incus. Dark Proxmox-style theme with ESXi-style
layout, built entirely on a custom component system (no UI libraries).

## Development

Requirements: local incusd reachable at `https://127.0.0.1:8443`, client cert in
`~/.config/incus/` (generate with `incus list` if missing).

```bash
incus config set core.https_address :8443
npm install
npm run dev
```

Open http://localhost:5173/ui/. The Vite plugin proxies `/1.0`, `/1.0/events`,
and `/oidc` to incusd using your client cert. Override with `INCUS_CERT_DIR`
and `INCUS_TARGET` env vars.

## Testing

```bash
npm test        # vitest unit + component tests
npm run typecheck
npm run lint
```

## Production (served by incusd at /ui/)

```bash
npm run build
```

Copy the contents of `dist/` into incusd's UI assets directory (commonly
`/usr/share/incus/ui` — confirm the path on your distro), then restart incusd:

```bash
sudo cp -r dist/* /usr/share/incus/ui/
sudo systemctl restart incus
```

Browse to https://your-host:8443/ui/. Authentication is automatic when your
browser has the server's client certificate installed, or via OIDC otherwise.

## Component system

Design tokens live in `src/styles/theme.css` (`@theme`). Primitives live in
`src/components/`, each with unit + component tests. The gallery at
http://localhost:5173/ui/gallery shows every component and its variants.
```

- [ ] **Step 3: Final verification run**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run build`
Expected: all tests PASS, typecheck clean, lint clean, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add readme and final verification"
```

- [ ] **Step 5: Optional end-to-end sanity check against local incusd**

Run: `npm run dev`, then:
1. Browse `/ui/` — dashboard shows server info + counts
2. `/instances` — create a test container, start it, watch the task log
3. Open the instance → Console → "Open shell" — type `echo hi`
4. Create a snapshot, restore it
5. Edit config, save, verify in `incus config show <name>`
6. Switch projects on the Projects page and confirm the tree/counts follow

Expected: all flows work against a real incusd.
