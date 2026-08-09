import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Server } from "lucide-react";
import { clusterApi } from "../api";
import type { ClusterMember } from "../api/types";
import { Badge } from "../components/badge";
import { InstancesPage } from "./instances";

export function MemberView() {
  const { name = "" } = useParams();
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
      {member && (
        <div className="flex items-center gap-3 border-b border-border bg-surface-900 px-6 py-3">
          <Server size={18} className="text-text-secondary" />
          <h1 className="text-base font-semibold text-text-primary">{member.server_name}</h1>
          <Badge tone={member.status === "Online" ? "success" : "neutral"}>{member.status}</Badge>
          <span className="text-xs text-text-tertiary">{member.architecture}</span>
        </div>
      )}
      <InstancesPage location={name} />
    </div>
  );
}
