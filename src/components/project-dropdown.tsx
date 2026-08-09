import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { projectsStore, currentProjectStore, setCurrentProject } from "../state/projects";
import { useStore } from "../state/store";

export function ProjectDropdown() {
  const projects = useStore(projectsStore);
  const current = useStore(currentProjectStore);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative px-2 pb-1">
      <button
        data-testid="project-selector"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-full items-center justify-between rounded border border-border bg-surface-700 px-2.5 text-[13px] text-text-primary hover:bg-surface-600"
      >
        <span className="truncate">{current}</span>
        <ChevronsUpDown size={14} className="text-text-tertiary" />
      </button>
      {open && (
        <div data-testid="project-menu" className="absolute left-2 right-2 z-40 mt-1 overflow-hidden rounded border border-border bg-surface-800 shadow-xl">
          {projects.map((p) => (
            <button
              key={p.name}
              data-testid={`project-option-${p.name}`}
              onClick={() => {
                setCurrentProject(p.name);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[13px] hover:bg-surface-700 ${p.name === current ? "text-accent-400" : "text-text-primary"}`}
            >
              <span className="truncate">{p.name}</span>
              {p.name === current && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
