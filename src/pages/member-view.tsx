import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Boxes, Gauge } from "lucide-react";
import { clusterApi } from "../api";
import type { ClusterMember } from "../api/types";
import { Badge } from "../components/badge";
import { KeyValueTable } from "../components/key-value-table";
import { VerticalTabs } from "../components/vertical-tabs";
import type { VerticalTabItem } from "../components/vertical-tabs";
import { InstancesPage } from "./instances";

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
    <div data-testid="member-view">
      <div className="flex h-full">
        <VerticalTabs tabs={tabs} active={tab} onChange={(key) => setSearchParams({ tab: key })} />
        <div className="min-w-0 flex-1 overflow-auto">
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
          {tab === "instances" && <InstancesPage location={name} />}
        </div>
      </div>
    </div>
  );
}
