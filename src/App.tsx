import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "./shell/layout";
import { AuthScreen } from "./auth/auth-screen";
import { authStore } from "./auth/status";
import { useStore } from "./state/store";
import { Toaster } from "./components/toast";
import { DashboardPage } from "./pages/dashboard";
import { InstancesPage } from "./pages/instances";
import { InstanceCreatePage } from "./pages/instance-create";
import { InstanceDetailPage } from "./pages/instance-detail";
import { ImagesPage } from "./pages/images";
import { ProfilesPage } from "./pages/profiles";
import { NetworksPage } from "./pages/networks";
import { StoragePage } from "./pages/storage";
import { ProjectsPage } from "./pages/projects";
import { Gallery } from "./pages/gallery";

export function App() {
  const auth = useStore(authStore);

  if (auth === "unauthenticated") {
    return <AuthScreen onRetry={() => authStore.setState("unknown")} />;
  }

  return (
    <BrowserRouter basename="/ui/">
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<DashboardPage />} />
          <Route path="instances" element={<InstancesPage />} />
          <Route path="instances/new" element={<InstanceCreatePage />} />
          <Route path="instances/:name" element={<InstanceDetailPage />} />
          <Route path="instances/:name/:tab" element={<InstanceDetailPage />} />
          <Route path="images" element={<ImagesPage />} />
          <Route path="profiles" element={<ProfilesPage />} />
          <Route path="networks" element={<NetworksPage />} />
          <Route path="storage" element={<StoragePage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="gallery" element={<Gallery />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}
