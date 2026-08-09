import { useEffect, useState } from "react";
import { clusterApi } from "../api";
import { instancesStore, loadInstances } from "../state/instances";
import { currentProjectStore } from "../state/projects";
import { useStore } from "../state/store";
import type { ClusterMember, Instance } from "../api/types";

export interface TreeData {
  members: ClusterMember[];
  instancesByMember: Record<string, Instance[]>;
  unassigned: Instance[];
}

export function useTreeData(): TreeData {
  const project = useStore(currentProjectStore);
  const instances = useStore(instancesStore);
  const [members, setMembers] = useState<ClusterMember[]>([]);

  useEffect(() => {
    void loadInstances(project).catch(() => {});
  }, [project]);

  useEffect(() => {
    void clusterApi.listMembers().then(setMembers).catch(() => {});
  }, [project]);

  const byMember: Record<string, Instance[]> = {};
  const unassigned: Instance[] = [];
  for (const i of Object.values(instances)) {
    if (i.project !== project) continue;
    if (i.location && i.location !== "none") (byMember[i.location] ??= []).push(i);
    else unassigned.push(i);
  }

  return { members, instancesByMember: byMember, unassigned };
}
