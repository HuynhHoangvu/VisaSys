import React, { useState } from "react";
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
import PrivateRoute from "./router/PrivateRoute";
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
  const currentUser: AuthUser = JSON.parse(
    localStorage.getItem("flyvisa_user")!,
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
    navigate(isTeacherDeptUser(user) ? "/hr" : "/dashboard", { replace: true });
  };
  return <Login onLoginSuccess={handleLoginSuccess} />;
};

const isBossOrManager = (user: AuthUser) =>
  user.id === "admin" ||
  ["giám đốc", "phó giám đốc", "quản lý", "trưởng phòng"].some((r) =>
    user.role?.toLowerCase().includes(r),
  );

const isProcessingDept = (user: AuthUser) => {
  const isBoss =
    user.id === "admin" ||
    ["giám đốc", "phó giám đốc"].some((r) =>
      user.role?.toLowerCase().includes(r),
    );
  const isManager = ["quản lý", "trưởng phòng"].some((r) =>
    user.role?.toLowerCase().includes(r),
  );
  const isProcessingDeptUser = ["xử lý hồ sơ", "hồ sơ", "trợ lý giám đốc"].some(
    (d) => user.department?.toLowerCase().includes(d),
  );
  return (isBoss || isProcessingDeptUser) && !isManager;
};

const isTeacherDeptUser = (user: AuthUser) =>
  user.department?.toLowerCase().includes("giáo viên");

const isNotTeacherDeptUser = (user: AuthUser) => !isTeacherDeptUser(user);

const DefaultRedirect: React.FC = () => {
  const savedUser = localStorage.getItem("flyvisa_user");
  if (!savedUser) return <Navigate to="/login" replace />;
  const currentUser: AuthUser = JSON.parse(savedUser);
  return <Navigate to={isTeacherDeptUser(currentUser) ? "/hr" : "/dashboard"} replace />;
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
            <Route element={<PrivateRoute requiredRole={isNotTeacherDeptUser} />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/crm" element={<CrmPage />} />
              <Route path="/kpi" element={<KpiPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/services" element={<ServicesPage />} />
            </Route>

            {/* Routes chỉ dành cho Boss / Manager */}
            <Route element={<PrivateRoute requiredRole={isBossOrManager} />}>
              <Route path="/boss" element={<BossPage />} />
            </Route>

            {/* Routes chỉ dành cho bộ phận xử lý hồ sơ */}
            <Route element={<PrivateRoute requiredRole={isProcessingDept} />}>
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
