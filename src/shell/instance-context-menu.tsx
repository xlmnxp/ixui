import { useState } from "react";
import { MoveRight, Pencil, Play, RotateCw, Square, Terminal as TerminalIcon, Trash2 } from "lucide-react";
import { ContextMenu } from "../components/context-menu";
import type { ContextMenuItem } from "../components/context-menu";
import { ConfirmDialog } from "../components/confirm-dialog";
import { RenameInstanceDialog } from "../components/instance-dialogs";
import { toast } from "../components/toast";
import { instancesApi } from "../api";
import { loadInstances } from "../state/instances";
import { currentProjectStore } from "../state/projects";
import type { ClusterMember, Instance } from "../api/types";

export interface InstanceContextMenuProps {
  instance: Instance;
  x: number;
  y: number;
  members: ClusterMember[];
  onClose: () => void;
}

export function InstanceContextMenu({ instance, x, y, members, onClose }: InstanceContextMenuProps) {
  const [mode, setMode] = useState<"menu" | "rename" | "delete">("menu");
  const [deleting, setDeleting] = useState(false);

  const setState = async (action: "start" | "stop" | "restart") => {
    onClose();
    try {
      await instancesApi.setState(instance.name, action, false, instance.project);
      toast("info", `Requested ${action} for ${instance.name}`);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : `${action} failed`);
    }
  };

  const moveTo = async (member: string) => {
    onClose();
    try {
      await instancesApi.move(instance.name, { target: member }, instance.project);
      toast("success", `Move of ${instance.name} to ${member} requested`);
      void loadInstances(currentProjectStore.getState()).catch(() => {});
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Move failed");
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await instancesApi.delete(instance.name, instance.project);
      toast("success", `Deleted ${instance.name}`);
      void loadInstances(currentProjectStore.getState()).catch(() => {});
      onClose();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  };

  const running = instance.status === "Running";
  const otherMembers = members.filter((m) => m.server_name !== instance.location);

  const items: ContextMenuItem[] = [
    { id: "start", label: "Start", icon: <Play size={14} />, disabled: running, onSelect: () => void setState("start") },
    { id: "stop", label: "Stop", icon: <Square size={14} />, disabled: !running, onSelect: () => void setState("stop") },
    { id: "restart", label: "Restart", icon: <RotateCw size={14} />, disabled: !running, onSelect: () => void setState("restart") },
    {
      id: "terminal",
      label: "Terminal",
      icon: <TerminalIcon size={14} />,
      onSelect: () => {
        window.open(
          `/ui/terminal/${instance.name}?project=${encodeURIComponent(instance.project)}`,
          `terminal-${instance.name}`,
          "width=1000,height=640"
        );
        onClose();
      },
    },
    { id: "rename", label: "Rename", icon: <Pencil size={14} />, onSelect: () => setMode("rename") },
    {
      id: "move",
      label: "Move to node",
      icon: <MoveRight size={14} />,
      disabled: otherMembers.length === 0,
      children: otherMembers.map((m) => ({
        id: `move-${m.server_name}`,
        label: m.server_name,
        onSelect: () => void moveTo(m.server_name),
      })),
    },
    { id: "delete", label: "Delete", icon: <Trash2 size={14} />, danger: true, onSelect: () => setMode("delete") },
  ];

  return (
    <>
      {mode === "menu" && <ContextMenu x={x} y={y} items={items} onClose={onClose} />}
      <RenameInstanceDialog open={mode === "rename"} onClose={onClose} name={instance.name} project={instance.project} />
      <ConfirmDialog
        open={mode === "delete"}
        title={`Delete ${instance.name}`}
        body={`This permanently deletes ${instance.name} and its data.`}
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={onClose}
      />
    </>
  );
}
