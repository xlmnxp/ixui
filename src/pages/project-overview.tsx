import { useCallback, useState } from "react";
import { Boxes, Database, Image as ImageIcon, Network, UserCog } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { VerticalTabs } from "../components/vertical-tabs";
import type { VerticalTabItem } from "../components/vertical-tabs";
import { PageBar } from "../components/page-bar";
import type { BarState } from "../components/page-bar";
import { CreateInstanceWizard } from "../components/create-instance-wizard";
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
  const [wizardOpen, setWizardOpen] = useState(false);
  const [tabBar, setTabBar] = useState<BarState | null>(null);
  const tabParam = searchParams.get("tab");
  const tab: TabKey = TAB_KEYS.includes(tabParam as TabKey) ? (tabParam as TabKey) : "instances";

  const setTab = (key: string) => {
    setSearchParams({ tab: key }, { replace: false });
  };

  const openWizard = useCallback(() => setWizardOpen(true), []);

  return (
    <div className="flex h-full flex-col" data-testid="project-overview">
      <PageBar title={`Project ${project}`} actions={tabBar?.actions} />
      <div className="flex min-h-0 flex-1">
        <VerticalTabs tabs={TABS} active={tab} onChange={setTab} />
        <div className="min-w-0 flex-1 overflow-auto">
          {tab === "instances" && <InstancesPage onCreate={openWizard} registerBar={setTabBar} />}
          {tab === "images" && <ImagesPage registerBar={setTabBar} />}
          {tab === "profiles" && <ProfilesPage registerBar={setTabBar} />}
          {tab === "networks" && <NetworksPage registerBar={setTabBar} />}
          {tab === "storage" && <StoragePage registerBar={setTabBar} />}
        </div>
      </div>
      <CreateInstanceWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
