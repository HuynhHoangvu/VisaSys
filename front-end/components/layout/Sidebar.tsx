import React, { useState } from "react";
import type { SidebarProps, Workspace } from "../../types";

const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  currentUser,
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

  // --- LOGIC PHÂN QUYỀN TỐI ƯU ---

  // 1. Nhóm Quyền Cao Nhất (Giám đốc/Admin)
  const isBoss =
    currentUser.id === "admin" ||
    ["giám đốc", "phó giám đốc"].some((r) =>
      currentUser.role?.toLowerCase().includes(r),
    );

  // 2. Nhóm Quản lý (Trưởng phòng/Quản lý) - Nhóm bị chặn vào Xử lý hồ sơ
  const isManager = ["quản lý", "trưởng phòng"].some((r) =>
    currentUser.role?.toLowerCase().includes(r),
  );

  // 3. Nhóm Nhân viên thuộc bộ phận xử lý
  const isProcessingDept = ["xử lý hồ sơ", "hồ sơ", "trợ lý giám đốc"].some(
    (d) => currentUser.department?.toLowerCase().includes(d),
  );
  // QUYỀN 1: Xem Báo cáo Giám đốc (Sếp VÀ Quản lý đều xem được)
  const canViewBossReport = isBoss || isManager;
  // 4. Quyền vào phòng Xử lý hồ sơ:
  // Phải là Sếp HOẶC thuộc phòng ban liên quan, NHƯNG tuyệt đối không phải là Quản lý/Trưởng phòng đơn thuần
  const canAccessProcessing = (isBoss || isProcessingDept) && !isManager;

  return (
    <aside className="w-64 bg-gray-800 text-white flex flex-col shadow-lg z-10 shrink-0">
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
      <nav className="flex-1 p-4 space-y-2 mt-2 overflow-y-auto">
        {/* CHỈ HIỆN BÁO CÁO GIÁM ĐỐC NẾU LÀ SẾP TỔNG */}
        {canViewBossReport && (
          <button
            onClick={() => setCurrentView("boss")}
            className={`w-full flex items-center px-4 py-3 font-medium rounded-lg transition-colors ${
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

        {/* Menu CRM Sale - Ai cũng thấy hoặc có thể thêm logic chặn riêng nếu cần */}
        <button
          onClick={() => setCurrentView("crm")}
          className={`w-full flex items-center px-4 py-3 font-medium rounded-lg transition-colors ${
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

        {/* Menu Giao việc tuần — tất cả đều thấy */}
        <button
          onClick={() => setCurrentView("weekly_tasks")}
          className={`w-full flex items-center px-4 py-3 font-medium rounded-lg transition-colors ${
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

        {/* CỤM MENU XỬ LÝ HỒ SƠ (BỊ CHẶN VỚI QUẢN LÝ/TRƯỞNG PHÒNG) */}
        {canAccessProcessing && (
          <>
            <div className="pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Bộ phận Nghiệp vụ
            </div>
            <button
              onClick={() => setCurrentView("processing")}
              className={`w-full flex items-center px-4 py-3 font-medium rounded-lg transition-colors ${
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
              onClick={() => setCurrentView("processed_docs")}
              className={`w-full flex items-center px-4 py-3 font-medium rounded-lg transition-colors ${
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
              onClick={() => setCurrentView("recruitment")}
              className={`w-full flex items-center px-4 py-3 font-medium rounded-lg transition-colors ${
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

        <div className="pt-4 border-t border-gray-700"></div>

        {/* Menu Tài liệu công ty */}
        <button
          onClick={() => setCurrentView("documents")}
          className={`w-full flex items-center px-4 py-3 font-medium rounded-lg transition-colors ${
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

        {/* Menu Chấm công */}
        <button
          onClick={() => setCurrentView("hr")}
          className={`w-full flex items-center px-4 py-3 font-medium rounded-lg transition-colors ${
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
      </nav>
    </aside>
  );
};;

export default Sidebar;
