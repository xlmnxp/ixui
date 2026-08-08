import { useEffect, useState } from "react";
import { infraApi } from "../api";
import { instancesStore, loadInstances } from "../state/instances";
import { currentProjectStore } from "../state/projects";
import { useStore } from "../state/store";
import type { Instance } from "../api/types";

export interface ResourceCounts {
  instances: Instance[];
  counts: { images: number; profiles: number; networks: number; storage: number };
}

export function useResourceCounts(): ResourceCounts {
  const project = useStore(currentProjectStore);
  const instances = useStore(instancesStore);
  const [counts, setCounts] = useState({ images: 0, profiles: 0, networks: 0, storage: 0 });

  useEffect(() => {
    void loadInstances(project);
  }, [project]);

  useEffect(() => {
    void Promise.all([
      infraApi.listImages(),
      infraApi.listProfiles(),
      infraApi.listNetworks(),
      infraApi.listPools(),
    ]).then(([images, profiles, networks, pools]) => {
      setCounts({ images: images.length, profiles: profiles.length, networks: networks.length, storage: pools.length });
    }).catch(() => {
      // counts are best-effort; keep previous values
    });
  }, [project]);

  const scopedInstances = Object.values(instances).filter((i) => i.project === project);

  return { instances: scopedInstances, counts };
}
