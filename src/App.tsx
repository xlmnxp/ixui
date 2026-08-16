import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { Shell } from "./shell/layout";
import { ErrorBoundary } from "./components/error-boundary";
import { AuthScreen } from "./auth/auth-screen";
import { Loading } from "./components/loading";
import { authStore } from "./auth/status";
import { uiTitleStore, uiSsoOnlyStore } from "./state/ui-title";
import { startOidcLogin } from "./auth/login";
import { useStore } from "./state/store";
import { Toaster } from "./components/toast";
import { DashboardPage } from "./pages/dashboard";
import { InstanceDetailPage } from "./pages/instance-detail";
import { InstanceTerminal } from "./pages/instance-terminal";
import { Gallery } from "./pages/gallery";
import { ProjectsPage } from "./pages/projects";
import { ProjectOverview } from "./pages/project-overview";
import { MemberView } from "./pages/member-view";
import { CertificatesPage } from "./pages/certificates";
import { OperationsPage } from "./pages/operations";
import { ActivityPage } from "./pages/activity";
import { WarningsPage } from "./pages/warnings";
import { SettingsPage } from "./pages/settings";
import { ClusterGroupsPage } from "./pages/cluster-groups";

function TerminalPage() {
  const { name = "" } = useParams();
  return <InstanceTerminal instanceName={name} />;
}

export function App() {
  const auth = useStore(authStore);
  const uiTitle = useStore(uiTitleStore);
  const ssoOnly = useStore(uiSsoOnlyStore);

  useEffect(() => {
    document.title = uiTitle;
  }, [uiTitle]);

  // With user.ui.sso_only, skip the login page and go straight to the IdP.
  useEffect(() => {
    if (auth === "unauthenticated" && ssoOnly) {
      startOidcLogin();
    }
  }, [auth, ssoOnly]);

  // While the startup probe (GET /1.0) is still deciding between client-cert
  // and OIDC authentication, show a loading screen instead of a blank page.
  if (auth === "unknown") {
    return <Loading fullScreen dataTestId="auth-loading" label="Checking authentication…" />;
  }

  if (auth === "unauthenticated") {
    if (ssoOnly) {
      return <Loading fullScreen dataTestId="oidc-loading" label="Redirecting to single sign-on…" />;
    }
    return <AuthScreen onRetry={() => authStore.setState("unknown")} />;
  }

  return (
    <ErrorBoundary>
      <BrowserRouter basename="/ui/">
      <Routes>
        <Route path="terminal/:name" element={<TerminalPage />} />
        <Route element={<Shell />}>
          <Route index element={<ProjectOverview />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="members/:name" element={<MemberView />} />
          <Route path="instances" element={<Navigate to="/?tab=instances" replace />} />
          <Route path="images" element={<Navigate to="/?tab=images" replace />} />
          <Route path="profiles" element={<Navigate to="/?tab=profiles" replace />} />
          <Route path="networks" element={<Navigate to="/?tab=networks" replace />} />
          <Route path="storage" element={<Navigate to="/?tab=storage" replace />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="instances/:name/:tab?" element={<InstanceDetailPage />} />
          <Route path="gallery" element={<Gallery />} />
          <Route path="operations" element={<OperationsPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="warnings" element={<WarningsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="cluster-groups" element={<ClusterGroupsPage />} />
          <Route path="certificates" element={<CertificatesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
        <Toaster />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
