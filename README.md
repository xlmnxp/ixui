# ixui — Incus Web UI

> [!WARNING]
> **Pre-alpha.** ixui is in early, pre-alpha development — expect missing
> features, rough edges, and breaking changes. Don't rely on it to manage
> production Incus servers yet.

A hand-crafted React web UI for Incus. Dark Proxmox-style theme with ESXi-style
layout, built entirely on a custom component system (no UI libraries). Features
a cluster-aware member/instance tree, a project selector, vertical tabs for
instance views, and a floating create-instance wizard.

![ixui](docs/screenshot.png)

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

`lucide-react` is the only icon dependency (component system rule: no other UI
libraries).

The instance Terminal opens in a browser popup at `/ui/terminal/<instance>` with
a shell (and VGA toggle for VMs). The sidebar tree's `+` buttons create
instances, targeted at the hovered cluster member. Config-key descriptions come
from `GET /1.0/metadata` — enable them on the server with
`incus config set metadata.enabled true` (the UI shows "—" when unavailable).

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
`src/components/`, each with unit + component tests — including Window,
VerticalTabs, and ProjectDropdown. The gallery at
http://localhost:5173/ui/gallery shows every component and its variants.

## AI-assisted development

ixui is developed with substantial help from AI / LLM coding tools. Generated
code is human-reviewed and covered by the test suite, but given the pre-alpha
state you should apply the usual scrutiny before trusting it with your servers.
Bug reports are very welcome.
