import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Boxes, Database, FolderCog, Folder, Gauge, Globe, History, Image as ImageIcon, KeyRound, ListTodo, Users, Network, Play,
  Plus, RotateCw, Search, Server, Settings, ShieldCheck, Square, Terminal as TerminalIcon, TriangleAlert, UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { InstanceIcon } from "../shell/instance-icon";
import { filterCommands } from "../lib/palette";
import type { PaletteCommand, PaletteIcon } from "../lib/palette";

const ICONS: Record<PaletteIcon, LucideIcon> = {
  dashboard: Gauge, instances: Boxes, images: ImageIcon, profiles: UserCog, networks: Network, storage: Database,
  acls: ShieldCheck, zones: Globe, projects: FolderCog, operations: ListTodo, activity: History,
  warnings: TriangleAlert, cluster: Server, certificates: KeyRound, identities: Users, settings: Settings, project: Folder,
  create: Plus, start: Play, stop: Square, restart: RotateCw, terminal: TerminalIcon,
};

function CommandIcon({ cmd }: { cmd: PaletteCommand }) {
  if (cmd.instance) return <InstanceIcon status={cmd.instance.status} type={cmd.instance.type} />;
  const Icon = cmd.icon ? ICONS[cmd.icon] : Search;
  return <Icon size={15} className="text-text-secondary" aria-hidden />;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: PaletteCommand[];
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => (open ? filterCommands(commands, query) : []), [open, commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest" });
  }, [active, results]);

  if (!open) return null;

  const run = (cmd: PaletteCommand | undefined) => {
    if (!cmd) return;
    onClose();
    cmd.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(results[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = "";
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]" data-testid="command-palette">
      <div className="absolute inset-0 bg-black/60" data-testid="palette-backdrop" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-xl overflow-hidden rounded-lg border border-border bg-surface-800 shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search size={14} className="text-text-secondary" aria-hidden />
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={results[active] ? `palette-opt-${active}` : undefined}
            aria-label="Search commands"
            placeholder="Search instances, pages, projects, actions…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className="h-10 w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
          />
        </div>
        <ul id="palette-list" role="listbox" ref={listRef} className="max-h-[50vh] overflow-auto py-1">
          {results.length === 0 && <li className="px-3 py-4 text-center text-xs text-text-secondary">No matches</li>}
          {results.map((cmd, i) => {
            const showGroup = cmd.group !== lastGroup;
            lastGroup = cmd.group;
            return (
              <li key={cmd.id} role="presentation">
                {showGroup && !query.trim() && (
                  <div className="px-3 pb-0.5 pt-2 text-[10px] uppercase tracking-wide text-text-secondary">{cmd.group}</div>
                )}
                <div
                  id={`palette-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => run(cmd)}
                  className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-[13px] ${i === active ? "bg-accent-600/30 text-text-primary" : "text-text-secondary"}`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex w-4 shrink-0 justify-center" data-testid="palette-icon"><CommandIcon cmd={cmd} /></span>
                    <span className="truncate">
                    {query.trim() && <span className="mr-2 text-[10px] uppercase text-text-secondary">{cmd.group}</span>}
                    {cmd.label}
                    </span>
                  </span>
                  {cmd.hint && <span className="shrink-0 text-xs text-text-secondary">{cmd.hint}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
