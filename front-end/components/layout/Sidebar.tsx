import React, { useState } from "react";
import type {
  SidebarProps as OriginalSidebarProps,
  Workspace,
} from "../../types";

// Ghi đè SidebarProps để thêm trạng thái đóng/mở
interface SidebarProps extends OriginalSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  currentUser,
  isOpen = false,
  onClose,
}) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([
    { id: "ws-1", name: "Fly Visa" },
  ]);

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>("ws-1");

  const handleAddWorkspace = () => {
    const newName = window.prompt(
      "Nhập tên Doanh nghiệp / Group mới (VD: Công ty Web):",
    );
    if (newName && newName.trim() !== "") {
      const newWorkspace: Workspace = {
        id: `ws-${Date.now()}`,
        name: newName.trim(),
      };
      setWorkspaces([...workspaces, newWorkspace]);
      setActiveWorkspaceId(newWorkspace.id);
    }
  };

  const handleMenuClick = (view: string) => {
    setCurrentView(view);
    if (onClose) onClose(); // Tự động đóng sidebar trên mobile khi chọn xong menu
  };

  const isBoss =
    currentUser.id === "admin" ||
    ["giám đốc", "phó giám đốc"].some((r) =>
      currentUser.role?.toLowerCase().includes(r),
    );
  const isManager = ["quản lý", "trưởng phòng"].some((r) =>
    currentUser.role?.toLowerCase().includes(r),
  );
  const isProcessingDept = ["xử lý hồ sơ", "hồ sơ", "trợ lý giám đốc"].some(
    (d) => currentUser.department?.toLowerCase().includes(d),
  );

  const canViewBossReport = isBoss || isManager;
  const canAccessProcessing = (isBoss || isProcessingDept) && !isManager;

  return (
    <>
      {/* OVERLAY ĐEN MỜ KHI MỞ TRÊN MOBILE */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity"
          onClick={onClose}
        ></div>
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-gray-800 text-white flex flex-col shadow-2xl z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* HEADER CỦA SIDEBAR DÀNH CHO MOBILE ĐỂ NÚT ĐÓNG */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-900 lg:hidden">
          <span className="font-bold text-flygold">Menu Quản lý</span>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-lg"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* KHU VỰC ĐỔI DOANH NGHIỆP */}
        <div className="p-4 border-b border-gray-700 bg-gray-900 flex flex-col gap-2">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Không gian làm việc
          </span>
          <div className="flex items-center gap-2">
            <select
              value={activeWorkspaceId}
              onChange={(e) => setActiveWorkspaceId(e.target.value)}
              className="flex-1 bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-flygold focus:border-flygold block w-full p-2 outline-none cursor-pointer"
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddWorkspace}
              title="Thêm Doanh nghiệp / Group mới"
              className="w-9 h-9 flex items-center justify-center bg-gray-700 hover:bg-flygold hover:text-white border border-gray-600 rounded-lg transition-colors shrink-0"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* MENU ĐIỀU HƯỚNG CHÍNH */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto custom-scrollbar">
          {canViewBossReport && (
            <button
              onClick={() => handleMenuClick("boss")}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                currentView === "boss"
                  ? "bg-gray-700 text-flygold border-l-4 border-flygold"
                  : "hover:bg-gray-700 text-gray-300"
              }`}
            >
              <svg
                className="w-5 h-5 mr-3 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Báo cáo Giám đốc
            </button>
          )}

          <button
            onClick={() => handleMenuClick("crm")}
            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              currentView === "crm"
                ? "bg-gray-700 text-flygold border-l-4 border-flygold"
                : "hover:bg-gray-700 text-gray-300"
            }`}
          >
            <svg
              className="w-5 h-5 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            Quản lý Khách hàng
          </button>

          <button
            onClick={() => handleMenuClick("weekly_tasks")}
            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              currentView === "weekly_tasks"
                ? "bg-gray-700 text-flygold border-l-4 border-flygold"
                : "hover:bg-gray-700 text-gray-300"
            }`}
          >
            <svg
              className="w-5 h-5 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            Giao việc tuần
          </button>

          {canAccessProcessing && (
            <>
              <div className="pt-4 pb-1 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Bộ phận Nghiệp vụ
              </div>
              <button
                onClick={() => handleMenuClick("processing")}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  currentView === "processing"
                    ? "bg-gray-700 text-flygold border-l-4 border-flygold"
                    : "hover:bg-gray-700 text-gray-300"
                }`}
              >
                <svg
                  className="w-5 h-5 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                  />
                </svg>
                Xử lý hồ sơ
              </button>
              <button
                onClick={() => handleMenuClick("processed_docs")}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  currentView === "processed_docs"
                    ? "bg-gray-700 text-flygold border-l-4 border-flygold"
                    : "hover:bg-gray-700 text-gray-300"
                }`}
              >
                <svg
                  className="w-5 h-5 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                Hồ sơ Đã xử lý
              </button>
              <button
                onClick={() => handleMenuClick("recruitment")}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  currentView === "recruitment"
                    ? "bg-gray-700 text-flygold border-l-4 border-flygold"
                    : "hover:bg-gray-700 text-gray-300"
                }`}
              >
                <span className="mr-3 text-lg">👷</span>
                Tiến độ Tuyển dụng
              </button>
            </>
          )}

          <div className="mx-4 pt-3 border-t border-gray-700 mt-2"></div>

          <button
            onClick={() => handleMenuClick("documents")}
            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              currentView === "documents"
                ? "bg-gray-700 text-flygold border-l-4 border-flygold"
                : "hover:bg-gray-700 text-gray-300"
            }`}
          >
            <svg
              className="w-5 h-5 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            Tài liệu công ty
          </button>

          <button
            onClick={() => handleMenuClick("hr")}
            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              currentView === "hr"
                ? "bg-gray-700 text-flygold border-l-4 border-flygold"
                : "hover:bg-gray-700 text-gray-300"
            }`}
          >
            <svg
              className="w-5 h-5 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Chấm công
          </button>
          <button
            onClick={() => handleMenuClick("services")}
            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              currentView === "services"
                ? "bg-gray-700 text-flygold border-l-4 border-flygold"
                : "hover:bg-gray-700 text-gray-300"
            }`}
          >
            <svg
              className="w-5 h-5 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            Bảng Giá Dịch Vụ
          </button>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
