import { useEffect, useState } from "react";
import { clusterApi } from "../api";
import { ALL_PROJECTS } from "../api/client";
import { instancesStore, loadInstances } from "../state/instances";
import { projectsStore, currentProjectStore } from "../state/projects";
import { useStore } from "../state/store";
import type { ClusterMember, Instance } from "../api/types";

export interface ProjectGroup {
  name: string;
  byMember: Record<string, Instance[]>;
  unassigned: Instance[];
}

export interface TreeData {
  members: ClusterMember[];
  groups: ProjectGroup[];
}

export function useTreeData(): TreeData {
  const project = useStore(currentProjectStore);
  const projects = useStore(projectsStore);
  const instances = useStore(instancesStore);
  const [members, setMembers] = useState<ClusterMember[]>([]);

  useEffect(() => {
    void loadInstances(project).catch(() => {});
  }, [project]);

  useEffect(() => {
    void clusterApi.listMembers().then(setMembers).catch(() => {});
  }, [project]);

  const groups: ProjectGroup[] = [];
  if (project === ALL_PROJECTS) {
    const byProject = new Map<string, { byMember: Record<string, Instance[]>; unassigned: Instance[] }>();
    for (const p of projects) byProject.set(p.name, { byMember: {}, unassigned: [] });
    for (const i of Object.values(instances)) {
      const group = byProject.get(i.project) ?? { byMember: {}, unassigned: [] };
      if (i.location && i.location !== "none") (group.byMember[i.location] ??= []).push(i);
      else group.unassigned.push(i);
      byProject.set(i.project, group);
    }
    for (const [name, group] of [...byProject.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      groups.push({ name, byMember: group.byMember, unassigned: group.unassigned });
    }
  } else {
    const byMember: Record<string, Instance[]> = {};
    const unassigned: Instance[] = [];
    for (const i of Object.values(instances)) {
      if (i.project !== project) continue;
      if (i.location && i.location !== "none") (byMember[i.location] ??= []).push(i);
      else unassigned.push(i);
    }
    groups.push({ name: project, byMember, unassigned });
  }

  return { members, groups };
}
