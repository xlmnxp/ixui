import { Boxes, Database, Image as ImageIcon, Network, UserCog } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { VerticalTabs } from "../components/vertical-tabs";
import type { VerticalTabItem } from "../components/vertical-tabs";
import { Button } from "../components/button";
import { useStore } from "../state/store";
import { currentProjectStore } from "../state/projects";
import { InstancesPage } from "./instances";
import { ImagesPage } from "./images";
import { ProfilesPage } from "./profiles";
import { NetworksPage } from "./networks";
import { StoragePage } from "./storage";

const TAB_KEYS = ["instances", "images", "profiles", "networks", "storage"] as const;
type TabKey = (typeof TAB_KEYS)[number];

const TABS: VerticalTabItem[] = [
  { key: "instances", label: "Instances", icon: <Boxes size={14} /> },
  { key: "images", label: "Images", icon: <ImageIcon size={14} /> },
  { key: "profiles", label: "Profiles", icon: <UserCog size={14} /> },
  { key: "networks", label: "Networks", icon: <Network size={14} /> },
  { key: "storage", label: "Storage pools", icon: <Database size={14} /> },
];

export function ProjectOverview() {
  const project = useStore(currentProjectStore);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: TabKey = TAB_KEYS.includes(tabParam as TabKey) ? (tabParam as TabKey) : "instances";

  const setTab = (key: string) => {
    setSearchParams({ tab: key }, { replace: false });
  };

  return (
    <div className="flex h-full flex-col" data-testid="project-overview">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary">Project {project}</h1>
        <Button data-testid="overview-create">Create</Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <VerticalTabs tabs={TABS} active={tab} onChange={setTab} />
        <div className="min-w-0 flex-1 overflow-auto">
          {tab === "instances" && <InstancesPage />}
          {tab === "images" && <ImagesPage />}
          {tab === "profiles" && <ProfilesPage />}
          {tab === "networks" && <NetworksPage />}
          {tab === "storage" && <StoragePage />}
        </div>
      </div>
    </div>
  );
}
