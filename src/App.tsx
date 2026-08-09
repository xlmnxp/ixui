import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "./shell/layout";
import { AuthScreen } from "./auth/auth-screen";
import { authStore } from "./auth/status";
import { useStore } from "./state/store";
import { Toaster } from "./components/toast";
import { DashboardPage } from "./pages/dashboard";
import { InstanceCreatePage } from "./pages/instance-create";
import { InstanceDetailPage } from "./pages/instance-detail";
import { Gallery } from "./pages/gallery";
import { ProjectsPage } from "./pages/projects";
import { ProjectOverview } from "./pages/project-overview";
import { MemberView } from "./pages/member-view";

export function App() {
  const auth = useStore(authStore);

  if (auth === "unauthenticated") {
    return <AuthScreen onRetry={() => authStore.setState("unknown")} />;
  }

  return (
    <BrowserRouter basename="/ui/">
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<ProjectOverview />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="members/:name" element={<MemberView />} />
          <Route path="instances" element={<Navigate to="/?tab=instances" replace />} />
          <Route path="instances/new" element={<InstanceCreatePage />} />
          <Route path="images" element={<Navigate to="/?tab=images" replace />} />
          <Route path="profiles" element={<Navigate to="/?tab=profiles" replace />} />
          <Route path="networks" element={<Navigate to="/?tab=networks" replace />} />
          <Route path="storage" element={<Navigate to="/?tab=storage" replace />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="instances/:name/:tab?" element={<InstanceDetailPage />} />
          <Route path="gallery" element={<Gallery />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}
