import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Folder } from "lucide-react";
import { projectsStore, currentProjectStore, setCurrentProject } from "../state/projects";
import { ALL_PROJECTS } from "../api/client";
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

  const choose = (value: string) => {
    setCurrentProject(value);
    setOpen(false);
  };

  const label = current === ALL_PROJECTS ? "All projects" : current;

  const option = (value: string, text: string, testId: string) => {
    const selected = value === current;
    return (
      <button
        key={value}
        type="button"
        role="option"
        aria-selected={selected}
        data-testid={testId}
        onClick={() => choose(value)}
        className={`flex w-full items-center justify-between gap-2 px-2 py-1 text-left text-xs ${
          selected
            ? "bg-accent-600/15 font-medium text-accent-300"
            : "text-text-primary hover:bg-hover"
        }`}
      >
        <span className="truncate">{text}</span>
        {selected && <Check size={13} className="shrink-0" />}
      </button>
    );
  };

  return (
    <div ref={rootRef} className="relative mt-1">
      {/* Flush row on the sidebar rail, like VS Code's repository picker. */}
      <button
        type="button"
        data-testid="project-selector"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Project: ${label}`}
        title={label}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-full items-center gap-1.5 px-2 text-xs font-medium text-text-primary hover:bg-hover focus-visible:bg-surface-700 focus-visible:outline-none"
      >
        <Folder size={13} className="shrink-0 text-text-tertiary" />
        <span className="truncate">{label}</span>
        <ChevronsUpDown size={13} className="ml-auto shrink-0 text-text-tertiary" />
      </button>
      {open && (
        <div
          data-testid="project-menu"
          role="listbox"
          aria-label="Project"
          className="absolute left-2 right-2 top-full z-40 mt-1 max-h-60 overflow-y-auto rounded border border-border bg-surface-800 py-0.5 shadow-xl"
        >
          {option(ALL_PROJECTS, "All projects", "project-option-all")}
          {projects.map((p) => option(p.name, p.name, `project-option-${p.name}`))}
        </div>
      )}
    </div>
  );
}
