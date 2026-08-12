import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Boxes, Copy, Gauge, KeyRound, Power, RotateCcw, Server } from "lucide-react";
import { clusterApi, resourcesApi } from "../api";
import { ApiError } from "../api/client";
import type { ClusterMember, ClusterGroup } from "../api/types";
import type { HostResources } from "../api/resources";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
import { Checkbox } from "../components/checkbox";
import { Dialog } from "../components/dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { EmptyState } from "../components/empty-state";
import { Input } from "../components/input";
import { KeyValueTable } from "../components/key-value-table";
import { VerticalTabs } from "../components/vertical-tabs";
import type { VerticalTabItem } from "../components/vertical-tabs";
import { SplitPane } from "../components/split-pane";
import { InstancesPage } from "./instances";
import { CreateInstanceWizard } from "../components/create-instance-wizard";
import type { BarState } from "../components/page-bar";
import { toast } from "../components/toast";
import { formatBytes } from "../lib/format";

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

  const [confirmAction, setConfirmAction] = useState<"evacuate" | "restore" | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [groups, setGroups] = useState<ClusterGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [token, setToken] = useState("");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [capacity, setCapacity] = useState<HostResources | null>(null);
  const [denied, setDenied] = useState(false);

  const refresh = useCallback(() => {
    void clusterApi.listMembers().then((m) => {
      setMembers(m);
      setLoaded(true);
    }).catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 403) setDenied(true);
      setLoaded(true);
    });
  }, []);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    if (!name) return;
    void resourcesApi.getMemberResources(name).then(setCapacity).catch(() => setCapacity(null));
  }, [name]);

  useEffect(() => {
    if (!tokenOpen) return;
    setToken("");
    void clusterApi.listGroups().then(setGroups).catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 403) setDenied(true);
    });
  }, [tokenOpen]);

  const member = members.find((m) => m.server_name === name);

  const runStateAction = async () => {
    if (!confirmAction) return;
    setActionBusy(true);
    try {
      await clusterApi.setMemberState(name, confirmAction);
      toast("success", `Member ${name} ${confirmAction === "evacuate" ? "evacuated" : "restored"}`);
      setConfirmAction(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionBusy(false);
    }
  };

  const openTokenDialog = () => {
    setTokenName(name);
    setSelectedGroups([]);
    setTokenOpen(true);
  };

  const toggleGroup = (group: string) => {
    setSelectedGroups((prev) => (prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]));
  };

  const createToken = async () => {
    if (!tokenName.trim()) return;
    setTokenBusy(true);
    try {
      const res = (await clusterApi.createJoinToken(tokenName.trim(), selectedGroups)) as { token?: unknown } | null;
      const value = res?.token;
      if (typeof value === "string" && value.length > 0) {
        setToken(value);
      } else {
        toast("danger", "No join token returned");
      }
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Token creation failed");
    } finally {
      setTokenBusy(false);
    }
  };

  const copyToken = async () => {
    try {
      await navigator.clipboard?.writeText(token);
      toast("success", "Token copied");
    } catch {
      toast("danger", "Copy failed");
    }
  };

  if (denied) {
    return (
      <div className="p-6" data-testid="member-view">
        <div data-testid="permission-denied">
          <EmptyState title="Permission denied" description="Your account does not have permission to view cluster members." />
        </div>
      </div>
    );
  }

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
          <div className="ml-auto flex items-center gap-1.5">
            {member.status === "Online" && (
              <Button size="sm" variant="danger" data-testid="member-evacuate" onClick={() => setConfirmAction("evacuate")}><Power size={14} /> Evacuate</Button>
            )}
            {member.status === "Evacuated" && (
              <Button size="sm" variant="secondary" data-testid="member-restore" onClick={() => setConfirmAction("restore")}><RotateCcw size={14} /> Restore</Button>
            )}
            <Button size="sm" variant="secondary" data-testid="member-join-token" onClick={openTokenDialog}><KeyRound size={14} /> Join token</Button>
            {tabBar?.actions}
          </div>
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
                <div className="space-y-6">
                  <div>
                    <h2 className="mb-2 text-sm font-semibold text-text-primary">Member</h2>
                    <KeyValueTable rows={[
                      { key: "Member", value: member?.server_name ?? name },
                      { key: "Status", value: member ? <Badge tone={member.status === "Online" ? "success" : "neutral"}>{member.status}</Badge> : "—" },
                      { key: "Architecture", value: member?.architecture ?? "—" },
                      { key: "Database", value: member ? (member.database ? "Yes" : "No") : "—" },
                      { key: "URL", value: member?.url ?? "—" },
                      { key: "Message", value: member?.message || "—" },
                    ]} />
                  </div>
                  <div>
                    <h2 className="mb-2 text-sm font-semibold text-text-primary">Capacity</h2>
                    <KeyValueTable dataTestId="member-capacity" rows={[
                      { key: "CPU", value: capacity ? String(capacity.cpu?.total ?? "—") : "—" },
                      { key: "Memory total", value: capacity?.memory?.total ? formatBytes(capacity.memory.total) : "—" },
                      { key: "Memory used", value: capacity?.memory?.used ? formatBytes(capacity.memory.used) : "—" },
                    ]} />
                  </div>
                </div>
              )}
              {tab === "instances" && <InstancesPage location={name} onCreate={openCreate} registerBar={setTabBar} />}
            </div>
          }
        />
      </div>
      <CreateInstanceWizard open={wizardOpen} onClose={() => setWizardOpen(false)} targetMember={name} />

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction === "restore" ? "Restore member" : "Evacuate member"}
        body={confirmAction === "restore" ? `Restore member ${name}? Instances will be moved back.` : `Evacuate member ${name}? Instances will be moved to other members.`}
        confirmLabel={confirmAction === "restore" ? "Restore" : "Evacuate"}
        tone="danger"
        loading={actionBusy}
        onConfirm={runStateAction}
        onCancel={() => setConfirmAction(null)}
      />

      <Dialog open={tokenOpen} onClose={() => setTokenOpen(false)} title={`Join token for ${name}`} footer={
        <>
          {token ? (
            <Button variant="secondary" onClick={() => setTokenOpen(false)} data-testid="token-done">Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setTokenOpen(false)}>Cancel</Button>
              <Button onClick={createToken} loading={tokenBusy} data-testid="token-submit"><KeyRound size={14} /> Create token</Button>
            </>
          )}
        </>
      }>
        <div className="space-y-3">
          <Input label="Server name" name="token-name" data-testid="token-name" value={tokenName} onChange={(e) => setTokenName(e.target.value)} disabled={Boolean(token)} />
          {!token && (
            <div>
              <span className="text-xs font-medium text-text-secondary">Groups</span>
              <div className="mt-1 space-y-1">
                {groups.length === 0 && <span className="text-xs text-text-tertiary">No groups</span>}
                {groups.map((g) => (
                  <Checkbox
                    key={g.name}
                    data-testid={`token-group-${g.name}`}
                    label={g.name}
                    checked={selectedGroups.includes(g.name)}
                    onChange={() => toggleGroup(g.name)}
                  />
                ))}
              </div>
            </div>
          )}
          {token && (
            <div className="space-y-2">
              <span className="text-xs font-medium text-text-secondary">Token</span>
              <div className="flex items-center gap-2 rounded border border-border bg-surface-900 p-2">
                <code data-testid="token-value" className="min-w-0 flex-1 break-all text-xs text-text-primary">{token}</code>
                <Button size="sm" variant="secondary" data-testid="token-copy" onClick={copyToken}><Copy size={14} /> Copy</Button>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
