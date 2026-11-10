import { useCallback, useEffect, useState } from "react";
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
  /** Re-fetch instances and cluster members; resolves when both are in. */
  reload: () => Promise<void>;
}

export function useTreeData(): TreeData {
  const project = useStore(currentProjectStore);
  const instances = useStore(instancesStore);
  const [members, setMembers] = useState<ClusterMember[]>([]);

  const fetchMembers = useCallback(async () => {
    try {
      setMembers(await clusterApi.listMembers());
    } catch {
      // Keep the previous list when the daemon is unreachable.
    }
  }, []);

  useEffect(() => {
    void loadInstances(project).catch(() => {});
  }, [project]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers, project]);

  const reload = useCallback(async () => {
    await Promise.all([loadInstances(project).catch(() => {}), fetchMembers()]);
  }, [project, fetchMembers]);

  const byMember: Record<string, Instance[]> = {};
  const unassigned: Instance[] = [];
  for (const i of Object.values(instances)) {
    if (project !== ALL_PROJECTS && i.project !== project) continue;
    if (i.location && i.location !== "none") (byMember[i.location] ??= []).push(i);
    else unassigned.push(i);
  }

  return { members, instancesByMember: byMember, unassigned, reload };
}
