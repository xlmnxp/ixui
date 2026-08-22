import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";
import "@fontsource/ubuntu-mono/400.css";
import "@fontsource/ubuntu-mono/700.css";
import { Monitor, RotateCw, SquareTerminal } from "lucide-react";
import { SpiceMainConn, handle_resize } from "../../lib/spice/src/main.js";
import { instancesApi } from "../api";
import { registerInstanceProject } from "../api/client";
import { createSubprotocolShim } from "../lib/ws-shim";
import type { AsyncResponse } from "../api/types";
import { Button } from "../components/button";
import { EmptyState } from "../components/empty-state";
import { Spinner } from "../components/spinner";
import { TabStrip } from "../components/tab-strip";
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

interface SessionProps {
  instanceName: string;
  kind: "exec" | "console";
  active: boolean;
  tabId: string;
  onSwitch: () => void;
  onProcess?: (command: string) => void;
  onTitle?: (title: string) => void;
}

function TerminalSession({ instanceName, kind, active, tabId, onSwitch, onProcess, onTitle }: SessionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const controlRef = useRef<WebSocket | null>(null);
  const spiceRef = useRef<{ stop?: () => void } | null>(null);
  const sessionRef = useRef(0);
  const shimRef = useRef(createSubprotocolShim());
  const connectTimerRef = useRef<number | null>(null);
  const fitResizeRef = useRef<(() => void) | null>(null);

  // The vendored spice handle_resize dereferences window.spice_connection
  // without a guard; only invoke it when a connection is actually present to
  // avoid "Cannot set properties of undefined (setting 'spice_resize_timer')".
  const safeHandleResize = () => {
    const sc = (window as { spice_connection?: unknown }).spice_connection;
    if (sc) handle_resize();
  };

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
    window.removeEventListener("resize", safeHandleResize);
    if (fitResizeRef.current) {
      window.removeEventListener("resize", fitResizeRef.current);
      fitResizeRef.current = null;
    }
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
                const result = await instancesApi.exec(instanceName, command, true);
                onProcess?.(command[0] ?? "shell");
                return result;
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
          screen_id: `spice-screen-${tabId}`,
          onerror: onError,
          onsuccess: () => {
            clearConnectTimer();
            setStatus("connected");
            safeHandleResize();
          },
        });
        (window as { spice_connection?: unknown }).spice_connection = conn;
        spiceRef.current = conn;
        window.addEventListener("resize", safeHandleResize);
        return;
      }

      // xterm measures glyph metrics at open(); the font must be loaded first
      // or the grid is sized against the fallback font.
      await document.fonts?.load('13px "Ubuntu Mono"').catch(() => {});
      if (session !== sessionRef.current || !containerRef.current) return;

      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: '"Ubuntu Mono", monospace',
        theme: { background: "#191817" },
      });
      const fit = new FitAddon();
      terminal.loadAddon(fit);
      terminal.open(containerRef.current);
      termRef.current = terminal;
      // Shells/processes set the window title via OSC 0/2; reflect it in the tab.
      terminal.onTitleChange((title) => {
        const trimmed = title.trim();
        if (trimmed) onTitle?.(trimmed);
      });

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
      // Refit the terminal when the window itself resizes.
      fitResizeRef.current = fitAndResize;
      window.addEventListener("resize", fitAndResize);
    } catch (err) {
      if (session !== sessionRef.current) return;
      cleanup();
      setStatus("error");
      toast("danger", err instanceof Error ? err.message : "Console failed to connect");
    }
  };

  useEffect(() => {
    void connect(kind);
    return disconnect;
  }, [kind]);

  // Refit when this tab becomes visible again (xterm in a hidden pane loses its size).
  useEffect(() => {
    if (!active) return;
    if (kind === "console") safeHandleResize();
    else fitResizeRef.current?.();
  }, [active, kind]);

  return (
    <div
      ref={containerRef}
      id={`spice-screen-${tabId}`}
      className={`relative min-h-0 flex-1 bg-surface-950 ${active ? "" : "hidden"}`}
    >
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
            title={kind === "console" ? "Console unavailable" : "Shell unavailable"}
            description={
              kind === "console"
                ? "The console could not connect. Check that the instance is running, then retry or open a Shell tab."
                : "The shell could not connect. Check that the instance is running, then retry or switch to the Console."
            }
            action={
              <div className="flex items-center justify-center gap-2">
                <Button size="sm" data-testid="term-retry" onClick={() => void connect(kind)}>
                  <RotateCw size={14} /> Retry
                </Button>
                <Button size="sm" variant="secondary" data-testid="term-switch" onClick={onSwitch}>
                  {kind === "console" ? <SquareTerminal size={14} /> : <Monitor size={14} />} Switch to {kind === "console" ? "Shell" : "Console"}
                </Button>
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}

interface TabDef {
  id: string;
  kind: "exec" | "console";
  name?: string;
  color?: string;
  process?: string;
  title?: string;
}

const basename = (path: string) => path.split("/").pop() ?? path;


export function InstanceTerminal({ instanceName }: InstanceTerminalProps) {
  const project = new URLSearchParams(window.location.search).get("project") ?? undefined;

  useEffect(() => {
    if (project) registerInstanceProject(instanceName, project);
  }, [instanceName, project]);

  const initialKind: "exec" | "console" =
    new URLSearchParams(window.location.search).get("mode") === "vga" ? "console" : "exec";
  const [tabs, setTabs] = useState<TabDef[]>([{ id: "t0", kind: initialKind }]);
  const [activeId, setActiveId] = useState("t0");
  const nextIdRef = useRef(1);

  const reorderTabs = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setTabs((prev) => {
      const fromIdx = prev.findIndex((t) => t.id === fromId);
      const toIdx = prev.findIndex((t) => t.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved!);
      return next;
    });
  };

  const addShellTab = () => {
    const id = `t${nextIdRef.current++}`;
    setTabs((prev) => [...prev, { id, kind: "exec" }]);
    setActiveId(id);
  };

  const closeTab = (id: string) => {
    setTabs((prev) => {
      if (prev.length === 1) return prev;
      const next = prev.filter((t) => t.id !== id);
      setActiveId((cur) => (cur === id ? (next[next.length - 1]?.id ?? "t0") : cur));
      return next;
    });
  };

  const switchKindOf = (id: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, kind: t.kind === "console" ? "exec" : "console" } : t))
    );
  };

  const stripTabs = tabs.map((tab) => {
    const fallback = tab.kind === "exec"
      ? `${instanceName} : ${tab.process ? basename(tab.process) : "shell"}`
      : instanceName;
    return {
      id: tab.id,
      label: tab.name ?? tab.title ?? fallback,
      icon: (tab.kind === "console" ? "console" : "shell") as "console" | "shell",
      color: tab.color,
    };
  });

  const handleRename = (id: string, name: string, color: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, name: name || undefined, color: color || undefined } : t
      )
    );
  };

  return (
    <div className="flex h-screen flex-col" data-testid="instance-terminal">
      <TabStrip
        tabs={stripTabs}
        activeId={activeId}
        onSwitch={setActiveId}
        onClose={closeTab}
        onReorder={reorderTabs}
        onRename={handleRename}
        onAdd={addShellTab}
        onAddLabel="Add shell tab"
        minTabs={1}
        dataTestId="term-tab"
      />
      <div className="flex min-h-0 flex-1 flex-col">
        {tabs.map((tab) => (
          <TerminalSession
            key={tab.id}
            instanceName={instanceName}
            kind={tab.kind}
            active={tab.id === activeId}
            tabId={tab.id}
            onSwitch={() => switchKindOf(tab.id)}
            onProcess={(cmd) =>
              setTabs((prev) => prev.map((t) => (t.id === tab.id ? { ...t, process: cmd } : t)))
            }
            onTitle={(title) =>
              setTabs((prev) => prev.map((t) => (t.id === tab.id ? { ...t, title } : t)))
            }
          />
        ))}
      </div>
    </div>
  );
}
