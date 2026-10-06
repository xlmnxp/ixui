import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CommandPalette } from "../components/command-palette";
import { toast } from "../components/toast";
import { instancesApi } from "../api";
import { buildCommands } from "../lib/palette";
import { instancesStore } from "../state/instances";
import { projectsStore, setCurrentProject } from "../state/projects";
import { paletteOpenStore, requestCreateInstance, setPaletteOpen } from "../state/ui-actions";
import { useStore } from "../state/store";
import type { Instance } from "../api/types";

/** Mounts the Ctrl/Cmd+K command palette and wires it to app state. */
export function PaletteHost() {
  const open = useStore(paletteOpenStore);
  const instances = useStore(instancesStore);
  const projects = useStore(projectsStore);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpenStore.getState());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commands = useMemo(
    () =>
      buildCommands({
        instances: Object.values(instances).sort((a, b) => a.name.localeCompare(b.name)),
        projects,
        navigate,
        setProject: setCurrentProject,
        createInstance: requestCreateInstance,
        openTerminal: (i: Instance) =>
          window.open(`/ui/terminal/${i.name}?project=${encodeURIComponent(i.project)}`, `terminal-${i.name}`, "width=1000,height=640"),
        instanceAction: (i, action) => {
          instancesApi
            .setState(i.name, action, false, i.project)
            .then(() => toast("info", `Requested ${action} for ${i.name}`))
            .catch((err: unknown) => toast("danger", err instanceof Error ? err.message : `${action} failed`));
        },
      }),
    [instances, projects, navigate],
  );

  return <CommandPalette open={open} onClose={() => setPaletteOpen(false)} commands={commands} />;
}
