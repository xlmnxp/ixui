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

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function ConsoleTab({ instanceName }: ConsoleTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const controlRef = useRef<WebSocket | null>(null);
  const sessionRef = useRef(0);

  const cleanup = () => {
    wsRef.current?.close();
    wsRef.current = null;
    controlRef.current?.close();
    controlRef.current = null;
    termRef.current?.dispose();
    termRef.current = null;
  };

  const disconnect = () => {
    sessionRef.current++;
    cleanup();
    setStatus("idle");
  };

  const connect = async (kind: "exec" | "console") => {
    if (!containerRef.current) return;
    disconnect();
    const session = sessionRef.current;
    setStatus("connecting");
    try {
      const result = await (kind === "exec"
        ? instancesApi.exec(instanceName, ["/bin/sh"], true)
        : instancesApi.console(instanceName, 80, 24));
      if (session !== sessionRef.current) return;

      const resultOp = (result as AsyncResponse | null)?.operation;
      const opId = resultOp?.split("/").pop();
      const metadata = (result as AsyncResponse)?.metadata;
      const fds = (metadata?.metadata as { fds?: Record<string, string> } | undefined)?.fds;
      const secret = fds?.["0"];
      const controlSecret = fds?.["control"];
      if (!opId || !secret) throw new Error("No websocket endpoint in operation metadata");
      const wsPath = `/1.0/operations/${opId}/websocket?secret=${encodeURIComponent(secret)}`;
      const controlPath = controlSecret ? `/1.0/operations/${opId}/websocket?secret=${encodeURIComponent(controlSecret)}` : null;

      const terminal = new Terminal({ cursorBlink: true, fontSize: 13, theme: { background: "#15181b" } });
      const fit = new FitAddon();
      terminal.loadAddon(fit);
      terminal.open(containerRef.current);
      termRef.current = terminal;

      const ws = new WebSocket(toWsUrl(wsPath));
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;
      const control = controlPath ? new WebSocket(toWsUrl(controlPath)) : null;
      controlRef.current = control;

      let reachedConnected = false;
      let lastDims: { cols: number; rows: number } | null = null;

      const sendResize = (cols: number, rows: number) => {
        lastDims = { cols, rows };
        if (control && control.readyState === WebSocket.OPEN) {
          control.send(
            JSON.stringify({ command: "window-resize", args: { width: String(cols), height: String(rows) } })
          );
        }
      };

      const fitAndResize = () => {
        fit.fit();
        const dims = fit.proposeDimensions();
        if (dims) sendResize(dims.cols, dims.rows);
      };

      if (control) {
        control.onopen = () => {
          if (lastDims) sendResize(lastDims.cols, lastDims.rows);
        };
      }
      ws.onopen = () => {
        reachedConnected = true;
        fitAndResize();
        terminal.focus();
        setStatus("connected");
      };
      ws.onmessage = (msg) => {
        const data = typeof msg.data === "string" ? msg.data : textDecoder.decode(msg.data);
        if (data) terminal.write(data);
      };
      ws.onclose = () => {
        if (wsRef.current !== ws) return;
        cleanup();
        setStatus("idle");
        if (reachedConnected) toast("info", "Console disconnected");
      };
      ws.onerror = () => {
        cleanup();
        setStatus("error");
        toast("danger", "Console connection failed");
      };
      terminal.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(textEncoder.encode(data));
      });
      terminal.onResize(fitAndResize);
    } catch (err) {
      if (session !== sessionRef.current) return;
      cleanup();
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
