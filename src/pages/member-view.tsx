import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Boxes, Gauge, Server } from "lucide-react";
import { clusterApi } from "../api";
import type { ClusterMember } from "../api/types";
import { Badge } from "../components/badge";
import { KeyValueTable } from "../components/key-value-table";
import { VerticalTabs } from "../components/vertical-tabs";
import type { VerticalTabItem } from "../components/vertical-tabs";
import { SplitPane } from "../components/split-pane";
import { InstancesPage } from "./instances";
import { CreateInstanceWizard } from "../components/create-instance-wizard";
import type { BarState } from "../components/page-bar";

const tabs: VerticalTabItem[] = [
  { key: "overview", label: "Overview", icon: <Gauge size={14} /> },
  { key: "instances", label: "Instances", icon: <Boxes size={14} /> },
];

export function MemberView() {
  const { name = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab = tabParam === "instances" ? "instances" : "overview";
  const [members, setMembers] = useState<ClusterMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tabBar, setTabBar] = useState<BarState | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const openCreate = useCallback(() => setWizardOpen(true), []);

  useEffect(() => {
    void clusterApi.listMembers().then((m) => {
      setMembers(m);
      setLoaded(true);
    }).catch(() => {
      setLoaded(true);
    });
  }, []);

  const member = members.find((m) => m.server_name === name);

  if (loaded && !member) {
    return (
      <div className="p-6" data-testid="member-view">
        <h1 className="text-lg font-semibold text-text-primary">Member not found</h1>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="member-view">
      {member && (
        <div className="flex items-center gap-3 border-b border-border bg-surface-900 px-4 py-2" data-testid="member-header">
          <Server size={18} className="text-text-secondary" />
          <h1 className="text-base font-semibold text-text-primary">{member.server_name}</h1>
          <Badge tone={member.status === "Online" ? "success" : "neutral"}>{member.status}</Badge>
          <span className="text-xs text-text-tertiary">{member.architecture}</span>
          {tabBar?.actions && tabBar.actions.length > 0 && (
            <div className="ml-auto flex items-center gap-1.5">{tabBar.actions}</div>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <SplitPane
          initial={20}
          min={12}
          left={<VerticalTabs tabs={tabs} active={tab} onChange={(key) => setSearchParams({ tab: key })} />}
          right={
            <div className="h-full overflow-auto">
              {tab === "overview" && (
                <KeyValueTable rows={[
                  { key: "Member", value: member?.server_name ?? name },
                  { key: "Status", value: member ? <Badge tone={member.status === "Online" ? "success" : "neutral"}>{member.status}</Badge> : "—" },
                  { key: "Architecture", value: member?.architecture ?? "—" },
                  { key: "Database", value: member ? (member.database ? "Yes" : "No") : "—" },
                  { key: "URL", value: member?.url ?? "—" },
                  { key: "Message", value: member?.message || "—" },
                ]} />
              )}
              {tab === "instances" && <InstancesPage location={name} onCreate={openCreate} registerBar={setTabBar} />}
            </div>
          }
        />
      </div>
      <CreateInstanceWizard open={wizardOpen} onClose={() => setWizardOpen(false)} targetMember={name} />
    </div>
  );
}
