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
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/1.0") && !req.url?.startsWith("/oidc")) {
          next();
          return;
        }
        const { host: _host, ...headers } = req.headers;
        const upstream = https.request(
          { host: target.hostname, port: target.port, path: req.url, method: req.method, agent, headers },
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
            upstream.on("message", (data) => client.send(String(data)));
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
