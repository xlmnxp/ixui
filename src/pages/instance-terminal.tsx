import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";
import "@fontsource/ubuntu-mono/400.css";
import "@fontsource/ubuntu-mono/700.css";
import { Check, Monitor, Plus, RotateCw, SquareTerminal, X } from "lucide-react";
import { SpiceMainConn, handle_resize } from "../../lib/spice/src/main.js";
import { instancesApi } from "../api";
import { registerInstanceProject } from "../api/client";
import { createSubprotocolShim } from "../lib/ws-shim";
import type { AsyncResponse } from "../api/types";
import { Button } from "../components/button";
import { Dialog } from "../components/dialog";
import { EmptyState } from "../components/empty-state";
import { Input } from "../components/input";
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
            handle_resize();
          },
        });
        (window as { spice_connection?: unknown }).spice_connection = conn;
        spiceRef.current = conn;
        window.addEventListener("resize", handle_resize);
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
    if (kind === "console") handle_resize();
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

const TAB_COLORS = ["#3fb950", "#58a6ff", "#d29922", "#f85149", "#bc8cff", "#39c5cf", "#f0883e", "#e3b341"];

function tint(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function InstanceTerminal({ instanceName }: InstanceTerminalProps) {
  const project = new URLSearchParams(window.location.search).get("project") ?? undefined;

  useEffect(() => {
    if (project) registerInstanceProject(instanceName, project);
  }, [instanceName, project]);

  const initialKind: "exec" | "console" =
    new URLSearchParams(window.location.search).get("mode") === "vga" ? "console" : "exec";
  const [tabs, setTabs] = useState<TabDef[]>([{ id: "t0", kind: initialKind }]);
  const [activeId, setActiveId] = useState("t0");
  const [renameTab, setRenameTab] = useState<{ id: string; name: string; color: string } | null>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const nextIdRef = useRef(1);
  const stripRef = useRef<HTMLDivElement>(null);
  const dragFromRef = useRef<string | null>(null);
  const dragOverRef = useRef<string | null>(null);

  const updateOverflow = () => {
    const el = stripRef.current;
    if (!el) return;
    setOverflow({
      left: el.scrollLeft > 0,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  };

  // Keep the newest tab in view when the strip overflows.
  useEffect(() => {
    const el = stripRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
    updateOverflow();
  }, [tabs.length]);

  useEffect(() => {
    updateOverflow();
    window.addEventListener("resize", updateOverflow);
    return () => window.removeEventListener("resize", updateOverflow);
  }, []);

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

  const reorderTab = (fromId: string, toId: string) => {
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

  const shellLabels = new Map<string, string>();
  for (const tab of tabs) {
    const fallback = tab.kind === "exec"
      ? `${instanceName} : ${tab.process ? basename(tab.process) : "shell"}`
      : instanceName;
    shellLabels.set(tab.id, tab.name ?? tab.title ?? fallback);
  }

  const saveTabName = () => {
    if (!renameTab) return;
    const { id, name, color } = renameTab;
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name: name.trim() || undefined, color: color || undefined } : t))
    );
    setRenameTab(null);
  };

  return (
    <div className="flex h-screen flex-col" data-testid="instance-terminal">
      <div className="flex h-9 shrink-0 items-end bg-surface-800 pl-2 pr-1.5 pt-1">
        <div className="relative flex h-full min-w-0 flex-1 items-end">
        <div
          ref={stripRef}
          data-testid="term-tab-strip"
          onWheel={(e) => {
            const el = e.currentTarget;
            if (el.scrollWidth > el.clientWidth) {
              el.scrollLeft += e.deltaY;
            }
          }}
          onScroll={updateOverflow}
          className="flex h-full min-w-0 flex-1 items-end gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => {
            const label = shellLabels.get(tab.id) ?? "";
            const active = tab.id === activeId;
            return (
              <div
                key={tab.id}
                data-testid={`term-tab-${tab.id}`}
                role="button"
                tabIndex={0}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", tab.id);
                  e.dataTransfer.effectAllowed = "move";
                  dragFromRef.current = tab.id;
                  dragOverRef.current = null;
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  const fromId = dragFromRef.current;
                  if (fromId && fromId !== tab.id && dragOverRef.current !== tab.id) {
                    dragOverRef.current = tab.id;
                    reorderTab(fromId, tab.id);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromId = e.dataTransfer.getData("text/plain");
                  if (fromId) reorderTab(fromId, tab.id);
                  dragFromRef.current = null;
                  dragOverRef.current = null;
                }}
                onDragEnd={() => {
                  dragFromRef.current = null;
                  dragOverRef.current = null;
                }}
                aria-label={`Switch to ${label}`}
                onClick={() => setActiveId(tab.id)}
                onDoubleClick={() => setRenameTab({ id: tab.id, name: label, color: tab.color ?? "" })}
                className={`group flex max-w-52 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3 text-xs ${
                  active
                    ? "h-full rounded-t-md text-text-primary"
                    : "my-1 h-[calc(100%-0.5rem)] self-center rounded-md text-text-secondary hover:text-text-primary"
                }`}
                style={{
                  backgroundColor: tab.color
                    ? tint(tab.color, active ? 0.45 : 0.2)
                    : active
                      ? "#191817"
                      : undefined,
                  ...(tab.color ? ({ "--tab-color": tint(tab.color, 0.85) } as Record<string, string>) : {}),
                }}
              >
                {tab.kind === "console" ? <Monitor size={13} /> : <SquareTerminal size={13} />}
                <span className="min-w-0 truncate">{label}</span>
                {tabs.length > 1 && (
                  <button
                    type="button"
                    data-testid={`term-close-${tab.id}`}
                    aria-label={`Close ${label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className={`ml-0.5 shrink-0 rounded-full p-0.5 transition-colors ${tab.color ? "text-white/80 hover:bg-[var(--tab-color)] hover:text-white" : "text-text-tertiary hover:bg-surface-600 hover:text-text-primary"}`}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            data-testid="term-add-tab"
            aria-label="Add shell tab"
            onClick={addShellTab}
            className="mb-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-tertiary hover:bg-surface-700 hover:text-text-primary"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className={`pointer-events-none absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-surface-800 to-transparent transition-opacity ${overflow.left ? "opacity-100" : "opacity-0"}`} />
        <div className={`pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-surface-800 to-transparent transition-opacity ${overflow.right ? "opacity-100" : "opacity-0"}`} />
        </div>
      </div>
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

      <Dialog open={renameTab !== null} onClose={() => setRenameTab(null)} title="Rename tab" footer={
        <>
          <Button variant="secondary" onClick={() => setRenameTab(null)}><X size={14} /> Cancel</Button>
          <Button onClick={saveTabName} data-testid="tab-rename-save"><Check size={14} /> Save</Button>
        </>
      }>
        {renameTab && (
          <div className="space-y-3">
            <Input
              label="Name"
              name="tab-name"
              data-testid="tab-name"
              value={renameTab.name}
              onChange={(e) => setRenameTab({ ...renameTab, name: e.target.value })}
            />
            <div>
              <span className="text-xs font-medium text-text-secondary">Color</span>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {TAB_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    data-testid={`tab-color-${c}`}
                    aria-label={`Color ${c}`}
                    onClick={() => setRenameTab({ ...renameTab, color: renameTab.color === c ? "" : c })}
                    className={`h-5 w-5 rounded-full border ${renameTab.color === c ? "border-white" : "border-transparent"}`}
                    style={{ background: c }}
                  />
                ))}
                <button
                  type="button"
                  data-testid="tab-color-none"
                  onClick={() => setRenameTab({ ...renameTab, color: "" })}
                  className="ml-1 text-[11px] text-text-tertiary hover:text-text-primary"
                >
                  None
                </button>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
