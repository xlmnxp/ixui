import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, LogOut, X } from "lucide-react";
import { certificatesApi } from "../api";
import { ApiError } from "../api/client";
import type { Certificate } from "../api/certificates";
import type { AsyncResponse, SyncResponse } from "../api/types";
import { authStore } from "../auth/status";
import { startOidcLogout } from "../auth/login";
import { useStore } from "../state/store";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { Dialog } from "../components/dialog";
import { Input } from "../components/input";
import { EmptyState } from "../components/empty-state";
import { PageBar } from "../components/page-bar";
import { toast } from "../components/toast";

function expiryToRfc3339(date: string): string {
  return date ? `${date}T23:59:59Z` : "";
}

function tokenFrom(result: AsyncResponse | SyncResponse | null): string | null {
  if (!result || typeof result !== "object") return null;
  const direct = (result as { token?: unknown }).token;
  if (typeof direct === "string") return direct;
  const metadata = (result as SyncResponse).metadata;
  if (metadata && typeof metadata === "object") {
    const inner = metadata as { token?: unknown };
    if (typeof inner.token === "string") return inner.token;
  }
  return null;
}

export function CertificatesPage() {
  const auth = useStore(authStore);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [issueOpen, setIssueOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [denied, setDenied] = useState(false);

  const refresh = useCallback(() => {
    void certificatesApi
      .list()
      .then(setCertificates)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) setDenied(true);
      });
  }, []);

  useEffect(refresh, [refresh]);

  const openIssue = () => {
    setIssueOpen(true);
    setToken(null);
    setCopied(false);
    setDescription("");
    setExpiry("");
  };

  const issue = async () => {
    setBusy(true);
    try {
      const result = await certificatesApi.createToken(description.trim(), expiryToRfc3339(expiry));
      const value = tokenFrom(result);
      if (value) {
        setToken(value);
        setCopied(false);
      } else {
        toast("danger", "Server returned no token");
      }
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Issue failed");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard?.writeText(token);
      setCopied(true);
      toast("success", "Token copied to clipboard");
    } catch {
      toast("danger", "Copy failed");
    }
  };

  const columns: Column<Certificate>[] = [
    { key: "fingerprint", header: "Fingerprint", sortValue: (c) => c.fingerprint, render: (c) => <span className="font-medium">{c.fingerprint}</span> },
    { key: "name", header: "Name", render: (c) => c.name || "—" },
    { key: "type", header: "Type", render: (c) => c.type },
    { key: "restricted", header: "Restricted", render: (c) => (c.restricted ? "Yes" : "No") },
    { key: "projects", header: "Projects", render: (c) => (c.projects.length > 0 ? c.projects.join(", ") : "—") },
  ];

  return (
    <div data-testid="certificates-page">
      <PageBar
        title="Certificates"
        actions={[
          ...(auth === "authenticated"
            ? [
                <Button key="logout" size="sm" variant="ghost" data-testid="auth-logout" onClick={startOidcLogout}>
                  <LogOut size={14} /> Sign out
                </Button>,
              ]
            : []),
          <Button key="issue" size="sm" data-testid="certificate-issue-open" onClick={openIssue}>
            <KeyRound size={14} /> Issue token
          </Button>,
        ]}
      />

      {denied ? (
        <div data-testid="permission-denied">
          <EmptyState title="Permission denied" description="Your account does not have permission to view certificates." />
        </div>
      ) : certificates.length === 0 ? (
        <EmptyState title="No certificates" />
      ) : (
        <Table columns={columns} rows={certificates} rowKey={(c) => c.fingerprint} emptyMessage="No certificates" stickyHeaderOffset={40} />
      )}

      <Dialog
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        title="Issue trust token"
        footer={
          token ? (
            <Button variant="secondary" onClick={() => setIssueOpen(false)} data-testid="token-close"><X size={14} /> Close</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setIssueOpen(false)}><X size={14} /> Cancel</Button>
              <Button onClick={issue} loading={busy} disabled={!description.trim() || !expiry} data-testid="token-issue-submit">
                <KeyRound size={14} /> Issue
              </Button>
            </>
          )
        }
      >
        {token ? (
          <div className="space-y-3" data-testid="token-result">
            <p>Copy the join token now — it is only shown once.</p>
            <div className="flex items-center gap-2">
              <code data-testid="token-value" className="flex-1 break-all rounded border border-border bg-surface-500 px-2 py-1.5 text-xs text-text-primary">
                {token}
              </code>
              <Button size="sm" data-testid="token-copy" onClick={copy}>
                <Copy size={14} /> {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Input label="Description" name="token-description" data-testid="token-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. laptop" />
            <Input label="Expiry" name="token-expiry" type="date" data-testid="token-expiry" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>
        )}
      </Dialog>
    </div>
  );
}
