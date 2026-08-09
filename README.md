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
