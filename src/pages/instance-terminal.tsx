import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";
import { Monitor, RotateCw, SquareTerminal, Terminal as TerminalIcon } from "lucide-react";
import { SpiceMainConn, handle_resize } from "../../lib/spice/src/main.js";
import { instancesApi } from "../api";
import { registerInstanceProject } from "../api/client";
import { createSubprotocolShim } from "../lib/ws-shim";
import type { AsyncResponse } from "../api/types";
import { Button } from "../components/button";
import { EmptyState } from "../components/empty-state";
import { Spinner } from "../components/spinner";
import { toast } from "../components/toast";

export interface InstanceTerminalProps {
  instanceName: string;
}

function toWsUrl(path: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${path}`;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** Shells to try for the exec console, in order: bash first, then sh. */
const SHELL_CANDIDATES: string[][] = [["/bin/bash"], ["/bin/sh"]];

/** Fallback for sockets that hang instead of closing. */
const CONNECT_TIMEOUT_MS = 10_000;

export function InstanceTerminal({ instanceName }: InstanceTerminalProps) {
  const project = new URLSearchParams(window.location.search).get("project") ?? undefined;

  useEffect(() => {
    if (project) registerInstanceProject(instanceName, project);
  }, [instanceName, project]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<"exec" | "console">("exec");
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const controlRef = useRef<WebSocket | null>(null);
  const spiceRef = useRef<{ stop?: () => void } | null>(null);
  const sessionRef = useRef(0);
  const shimRef = useRef(createSubprotocolShim());
  const connectTimerRef = useRef<number | null>(null);

  const clearConnectTimer = () => {
    if (connectTimerRef.current !== null) {
      window.clearTimeout(connectTimerRef.current);
      connectTimerRef.current = null;
    }
  };

  const armConnectTimer = () => {
    clearConnectTimer();
    connectTimerRef.current = window.setTimeout(() => {
      connectTimerRef.current = null;
      cleanup();
      setStatus("error");
      toast("danger", "Connection timed out — is the instance running?");
    }, CONNECT_TIMEOUT_MS);
  };

  const cleanup = () => {
    clearConnectTimer();
    shimRef.current.restore();
    wsRef.current?.close();
    wsRef.current = null;
    controlRef.current?.close();
    controlRef.current = null;
    termRef.current?.dispose();
    termRef.current = null;
    spiceRef.current?.stop?.();
    spiceRef.current = null;
    (window as { spice_connection?: unknown }).spice_connection = undefined;
    window.removeEventListener("resize", handle_resize);
  };

  const disconnect = () => {
    sessionRef.current++;
    cleanup();
    setStatus("idle");
  };

  const connect = async (nextKind: "exec" | "console") => {
    if (!containerRef.current) return;
    disconnect();
    const session = sessionRef.current;
    setStatus("connecting");
    try {
      const result = await (nextKind === "exec"
        ? (async () => {
            let lastError: unknown = null;
            for (const command of SHELL_CANDIDATES) {
              try {
                return await instancesApi.exec(instanceName, command, true);
              } catch (err) {
                lastError = err;
              }
            }
            throw lastError ?? new Error("Exec failed");
          })()
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

      if (nextKind === "console") {
        const control = controlPath ? new WebSocket(toWsUrl(controlPath)) : null;
        controlRef.current = control;
        const onError = () => {
          cleanup();
          setStatus("error");
          toast("danger", "Console connection failed");
        };
        if (control) control.onerror = onError;
        // spice-html5 requests the "binary" subprotocol which incusd does not
        // negotiate; drop subprotocols while the VGA console is active.
        shimRef.current.install();
        armConnectTimer();
        const conn = new SpiceMainConn({
          uri: toWsUrl(wsPath),
          password: "",
          screen_id: "spice-screen",
          onerror: onError,
          onsuccess: () => {
            clearConnectTimer();
            setStatus("connected");
            handle_resize();
          },
        });
        (window as { spice_connection?: unknown }).spice_connection = conn;
        spiceRef.current = conn;
        window.addEventListener("resize", handle_resize);
        return;
      }

      const terminal = new Terminal({ cursorBlink: true, fontSize: 13, theme: { background: "#191817" } });
      const fit = new FitAddon();
      terminal.loadAddon(fit);
      terminal.open(containerRef.current);
      termRef.current = terminal;

      const ws = new WebSocket(toWsUrl(wsPath));
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;
      const control = controlPath ? new WebSocket(toWsUrl(controlPath)) : null;
      controlRef.current = control;
      armConnectTimer();

      let reachedConnected = false;
      let receivedData = false;
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
        clearConnectTimer();
        reachedConnected = true;
        fitAndResize();
        terminal.focus();
        setStatus("connected");
      };
      ws.onmessage = (msg) => {
        receivedData = true;
        const data = typeof msg.data === "string" ? msg.data : textDecoder.decode(msg.data);
        if (data) terminal.write(data);
      };
      ws.onclose = () => {
        if (wsRef.current !== ws) return;
        cleanup();
        if (reachedConnected && receivedData) {
          // A session that produced output and then ended: clean disconnect.
          setStatus("idle");
          toast("info", "Console disconnected");
        } else {
          // No shell ever came up (e.g. VM without a running agent): fail fast.
          setStatus("error");
        }
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

  useEffect(() => {
    void connect("exec");
    return disconnect;
  }, []);

  const switchKind = (nextKind: "exec" | "console") => {
    setKind(nextKind);
    void connect(nextKind);
  };

  return (
    <div className="flex h-screen flex-col" data-testid="instance-terminal">
      <div className="flex h-10 items-center gap-2 border-b border-border bg-surface-900 px-3">
        <TerminalIcon size={14} className="text-text-secondary" />
        <span className="text-sm font-medium text-text-primary">{instanceName}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant={kind === "exec" ? "secondary" : "ghost"}
            disabled={status === "connecting"}
            onClick={() => switchKind("exec")}
            data-testid="term-shell"
          >
            <SquareTerminal size={14} /> Shell
          </Button>
          <Button
            size="sm"
            variant={kind === "console" ? "secondary" : "ghost"}
            disabled={status === "connecting"}
            onClick={() => switchKind("console")}
            data-testid="term-vga"
          >
            <Monitor size={14} /> VGA
          </Button>
        </div>
      </div>
      <div ref={containerRef} id="spice-screen" className="relative min-h-0 flex-1 bg-surface-950">
        {status === "connecting" && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-surface-950/80 text-sm text-text-secondary"
            data-testid="term-connecting"
          >
            <Spinner size="sm" /> Connecting…
          </div>
        )}
        {status === "error" && (
          <div className="flex h-full items-center justify-center p-6" data-testid="term-error">
            <EmptyState
              icon={kind === "console" ? <Monitor size={28} className="text-text-tertiary" /> : <SquareTerminal size={28} className="text-text-tertiary" />}
              title={kind === "console" ? "VGA console unavailable" : "Shell unavailable"}
              description={
                kind === "console"
                  ? "The VGA console could not connect. Check that the instance is running, then retry or switch to the Shell."
                  : "The shell could not connect. Check that the instance is running, then retry or switch to the VGA console."
              }
              action={
                <div className="flex items-center justify-center gap-2">
                  <Button size="sm" data-testid="term-retry" onClick={() => void connect(kind)}>
                    <RotateCw size={14} /> Retry
                  </Button>
                  <Button size="sm" variant="secondary" data-testid="term-switch" onClick={() => switchKind(kind === "console" ? "exec" : "console")}>
                    {kind === "console" ? <SquareTerminal size={14} /> : <Monitor size={14} />} Switch to {kind === "console" ? "Shell" : "VGA"}
                  </Button>
                </div>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
