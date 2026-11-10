import { useEffect, useState } from "react";
import { clusterApi } from "../api";
import { ALL_PROJECTS } from "../api/client";
import { instancesStore, loadInstances } from "../state/instances";
import { currentProjectStore } from "../state/projects";
import { useStore } from "../state/store";
import type { ClusterMember, Instance } from "../api/types";

export interface TreeData {
  members: ClusterMember[];
  instancesByMember: Record<string, Instance[]>;
  unassigned: Instance[];
  /** Re-fetch instances and cluster members. */
  reload: () => void;
}

export function useTreeData(): TreeData {
  const project = useStore(currentProjectStore);
  const instances = useStore(instancesStore);
  const [members, setMembers] = useState<ClusterMember[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    void loadInstances(project).catch(() => {});
  }, [project, reloadKey]);

  useEffect(() => {
    void clusterApi.listMembers().then(setMembers).catch(() => {});
  }, [project, reloadKey]);

  const byMember: Record<string, Instance[]> = {};
  const unassigned: Instance[] = [];
  for (const i of Object.values(instances)) {
    if (project !== ALL_PROJECTS && i.project !== project) continue;
    if (i.location && i.location !== "none") (byMember[i.location] ??= []).push(i);
    else unassigned.push(i);
  }

  return { members, instancesByMember: byMember, unassigned, reload: () => setReloadKey((key) => key + 1) };
}
