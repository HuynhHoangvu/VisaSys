import React, { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useNavigate,
  useLocation,
} from "react-router-dom";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import Login from "./components/auth/Login";
import PrivateRoute, {
  accessBossReport,
  accessMainApp,
  accessProcessingModule,
} from "./router/PrivateRoute";
import api from "./services/api";
import { defaultHomePath } from "./utils/access";
import CrmPage from "./pages/CrmPage";
import BossPage from "./pages/BossPage";
import HrPage from "./pages/HrPage";
import DocumentsPage from "./pages/DocumentsPage";
import ProcessedDocsPage from "./pages/ProcessedDocsPage";
import ProcessingPage from "./pages/ProcessingPage";
import ServicesPage from "./pages/ServicesPage";
import KpiPage from "./pages/KpiPage";
import RecruitmentPage from "./pages/RecruitmentPage";
import DashboardPage from "./pages/DashboardPage";
import SettingsPage from "./pages/SettingsPage";
import type { AuthUser } from "./types";

// Re-mounts on each route change so the fade-in animation replays
const PageWrapper: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <div
      key={pathname}
      className="flex-1 overflow-hidden flex flex-col relative z-0 page-fade-in"
    >
      <Outlet />
    </div>
  );
};

// Layout chung: Sidebar + Header + nội dung trang (Outlet)
const AppLayout: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser>(() =>
    JSON.parse(localStorage.getItem("flyvisa_user")!),
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<AuthUser>("/api/auth/me")
      .then((res) => {
        if (cancelled) return;
        localStorage.setItem("flyvisa_user", JSON.stringify(res.data));
        setCurrentUser(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("flyvisa_sidebar_collapsed") === "true",
  );

  const handleToggleSidebar = () => {
    if (window.innerWidth >= 1024) {
      setSidebarCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem("flyvisa_sidebar_collapsed", String(next));
        return next;
      });
    } else {
      setIsSidebarOpen(true);
    }
  };

  return (
    <div className="flex h-screen w-full bg-gray-100 font-sans text-gray-900 overflow-hidden">
      <Sidebar
        currentUser={currentUser}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() =>
          setSidebarCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem("flyvisa_sidebar_collapsed", String(next));
            return next;
          })
        }
      />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header
          currentUser={currentUser}
          onToggleSidebar={handleToggleSidebar}
        />
        <PageWrapper />
      </main>
    </div>
  );
};

// Trang Login có navigate sau khi đăng nhập thành công
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const handleLoginSuccess = (user: AuthUser) => {
    localStorage.setItem("flyvisa_user", JSON.stringify(user));
    navigate(defaultHomePath(user), { replace: true });
  };
  return <Login onLoginSuccess={handleLoginSuccess} />;
};

const DefaultRedirect: React.FC = () => {
  const savedUser = localStorage.getItem("flyvisa_user");
  if (!savedUser) return <Navigate to="/login" replace />;
  const currentUser: AuthUser = JSON.parse(savedUser);
  return <Navigate to={defaultHomePath(currentUser)} replace />;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Toaster position="bottom-right" toastOptions={{ duration: 4000 }} />
      <Routes>
        {/* Route công khai */}
        <Route path="/login" element={<LoginPage />} />

        {/* Routes yêu cầu đăng nhập */}
        <Route element={<PrivateRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DefaultRedirect />} />
            <Route path="/hr" element={<HrPage />} />
            <Route element={<PrivateRoute requiredAccess={accessMainApp} />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/crm" element={<CrmPage />} />
              <Route path="/kpi" element={<KpiPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/services" element={<ServicesPage />} />
            </Route>

            <Route element={<PrivateRoute requiredAccess={accessBossReport} />}>
              <Route path="/boss" element={<BossPage />} />
            </Route>

            <Route element={<PrivateRoute requiredAccess={accessProcessingModule} />}>
              <Route path="/processing" element={<ProcessingPage />} />
              <Route path="/processed-docs" element={<ProcessedDocsPage />} />
              <Route path="/recruitment" element={<RecruitmentPage />} />
            </Route>
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<DefaultRedirect />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
