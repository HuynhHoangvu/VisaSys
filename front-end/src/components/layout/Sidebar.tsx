import React, { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { FaceAvatar } from "../ui/FaceAvatar";
import type { SidebarProps, Workspace } from "../../types";
import api from "../../services/api";

type WsModalMode = "add" | "edit" | null;

const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  isOpen = false,
  onClose,
}) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>("");

  const [wsModal, setWsModal] = useState<WsModalMode>(null);
  const [wsFormName, setWsFormName] = useState("");
  const [wsFormUrl, setWsFormUrl] = useState("");
  const [wsError, setWsError] = useState("");
  const [wsSaving, setWsSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Tải danh sách workspace từ backend khi mount
  useEffect(() => {
    api.get<Workspace[]>("/api/workspaces").then((res) => {
      const list = res.data;
      setWorkspaces(list);
      if (list.length > 0) setActiveWorkspaceId(list[0].id);
    }).catch(() => {
      // Nếu lỗi (VD: chưa có ws nào), giữ list rỗng
    });
  }, []);

  // Focus input khi mở modal
  useEffect(() => {
    if (wsModal) setTimeout(() => nameInputRef.current?.focus(), 50);
  }, [wsModal]);

  const openAddModal = () => {
    setWsFormName("");
    setWsFormUrl("");
    setWsError("");
    setWsModal("add");
  };

  const openEditModal = () => {
    const ws = workspaces.find((w) => w.id === activeWorkspaceId);
    if (!ws) return;
    setWsFormName(ws.name);
    setWsFormUrl(ws.url ?? "");
    setWsError("");
    setWsModal("edit");
  };

  const closeModal = () => setWsModal(null);

  const handleSaveAdd = async () => {
    const name = wsFormName.trim();
    if (!name) { setWsError("Tên không được để trống."); return; }
    setWsSaving(true);
    try {
      const res = await api.post<Workspace>("/api/workspaces", {
        name,
        url: wsFormUrl.trim() || undefined,
      });
      setWorkspaces((prev) => [...prev, res.data]);
      setActiveWorkspaceId(res.data.id);
      closeModal();
    } catch (e) {
      setWsError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Lỗi khi tạo workspace");
    } finally {
      setWsSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    const name = wsFormName.trim();
    if (!name) { setWsError("Tên không được để trống."); return; }
    setWsSaving(true);
    try {
      const res = await api.put<Workspace>(`/api/workspaces/${activeWorkspaceId}`, {
        name,
        url: wsFormUrl.trim() || undefined,
      });
      setWorkspaces((prev) => prev.map((w) => w.id === activeWorkspaceId ? res.data : w));
      closeModal();
    } catch (e) {
      setWsError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Lỗi khi cập nhật workspace");
    } finally {
      setWsSaving(false);
    }
  };

  const handleDeleteActive = async () => {
    if (workspaces.length <= 1) {
      setWsError("Phải có ít nhất 1 không gian làm việc.");
      return;
    }
    setWsSaving(true);
    try {
      await api.delete(`/api/workspaces/${activeWorkspaceId}`);
      const remaining = workspaces.filter((w) => w.id !== activeWorkspaceId);
      setWorkspaces(remaining);
      setActiveWorkspaceId(remaining[0].id);
      closeModal();
    } catch (e) {
      setWsError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Lỗi khi xoá workspace");
    } finally {
      setWsSaving(false);
    }
  };

  const handleWorkspaceChange = (wsId: string) => {
    const ws = workspaces.find((w) => w.id === wsId);
    if (ws?.url) {
      window.open(ws.url, "_blank", "noopener,noreferrer");
    } else {
      setActiveWorkspaceId(wsId);
    }
  };

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  const isBoss =
    currentUser.id === "admin" ||
    ["giám đốc", "phó giám đốc"].some((r) =>
      currentUser.role?.toLowerCase().includes(r),
    );
  const isManager = ["quản lý", "trưởng phòng"].some((r) =>
    currentUser.role?.toLowerCase().includes(r),
  );
  const isProcessingDeptUser = ["xử lý hồ sơ", "hồ sơ", "trợ lý giám đốc"].some(
    (d) => currentUser.department?.toLowerCase().includes(d),
  );

  const canViewBossReport = isBoss || isManager;
  const canAccessProcessing = (isBoss || isProcessingDeptUser) && !isManager;

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${
      isActive
        ? "bg-orange-500/20 text-orange-300 border-l-[3px] border-orange-400 pl-[9px]"
        : "text-gray-400 hover:bg-gray-700/60 hover:text-gray-100"
    }`;

  return (
    <>
      {/* OVERLAY ĐEN MỜ KHI MỞ TRÊN MOBILE */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-gray-900 text-white flex flex-col shadow-2xl z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* LOGO / APP NAME */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-md shrink-0">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <span className="font-bold text-white text-sm">Fly Visa</span>
              <p className="text-[10px] text-gray-500 leading-none">
                Management System
              </p>
            </div>
          </div>
          {/* NÚT ĐÓNG TRÊN MOBILE */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* KHU VỰC ĐỔI KHÔNG GIAN LÀM VIỆC */}
        <div className="px-3 py-3 border-b border-gray-700/50">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">
            Không gian làm việc
          </p>
          <div className="flex items-center gap-1.5">
            <select
              value={activeWorkspaceId}
              onChange={(e) => handleWorkspaceChange(e.target.value)}
              className="flex-1 min-w-0 bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 p-2 outline-none cursor-pointer"
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.url ? `↗ ${ws.name}` : ws.name}
                </option>
              ))}
            </select>
            {/* NÚT SỬA */}
            <button
              onClick={openEditModal}
              title="Sửa không gian làm việc"
              className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-blue-600 border border-gray-700 hover:border-blue-500 rounded-lg transition-colors shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            {/* NÚT THÊM */}
            <button
              onClick={openAddModal}
              title="Thêm không gian làm việc mới"
              className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-orange-500 border border-gray-700 hover:border-orange-500 rounded-lg transition-colors shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* MODAL QUẢN LÝ WORKSPACE */}
        {wsModal && (
          <div className="absolute inset-0 z-60 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-20">
            <div className="w-[calc(100%-24px)] bg-gray-800 rounded-xl shadow-2xl border border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-100 mb-3">
                {wsModal === "add" ? "Thêm không gian làm việc" : "Sửa không gian làm việc"}
              </h3>

              <div className="space-y-2.5">
                <div>
                  <label className="text-[11px] text-gray-400 mb-1 block">Tên</label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={wsFormName}
                    onChange={(e) => { setWsFormName(e.target.value); setWsError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && (wsModal === "add" ? handleSaveAdd() : handleSaveEdit())}
                    placeholder="VD: FlyLabour"
                    className="w-full bg-gray-700 border border-gray-600 text-gray-100 text-sm rounded-lg px-3 py-2 outline-none focus:border-orange-500 placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 mb-1 block">
                    Link website <span className="text-gray-600">(tuỳ chọn)</span>
                  </label>
                  <input
                    type="url"
                    value={wsFormUrl}
                    onChange={(e) => setWsFormUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (wsModal === "add" ? handleSaveAdd() : handleSaveEdit())}
                    placeholder="https://example.com"
                    className="w-full bg-gray-700 border border-gray-600 text-gray-100 text-sm rounded-lg px-3 py-2 outline-none focus:border-orange-500 placeholder-gray-500"
                  />
                </div>
                {wsError && (
                  <p className="text-xs text-red-400">{wsError}</p>
                )}
              </div>

              <div className="flex items-center gap-2 mt-4">
                {wsModal === "add" ? (
                  <button
                    onClick={handleSaveAdd}
                    disabled={wsSaving}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                  >
                    {wsSaving ? "Đang lưu..." : "Thêm"}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      disabled={wsSaving}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                    >
                      {wsSaving ? "Đang lưu..." : "Lưu"}
                    </button>
                    <button
                      onClick={handleDeleteActive}
                      disabled={wsSaving}
                      title="Xoá workspace này"
                      className="w-9 h-9 flex items-center justify-center bg-red-600/20 hover:bg-red-600 disabled:opacity-50 border border-red-700/50 hover:border-red-600 text-red-400 hover:text-white rounded-lg transition-colors shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                )}
                <button
                  onClick={closeModal}
                  disabled={wsSaving}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  Huỷ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MENU ĐIỀU HƯỚNG CHÍNH */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto custom-scrollbar">
          {/* Dashboard */}
          <NavLink
            to="/dashboard"
            className={navLinkClass}
            onClick={handleNavClick}
          >
            <svg
              className="w-4.5 h-4.5 mr-3 shrink-0"
              style={{ width: "18px", height: "18px" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            Tổng quan
          </NavLink>

          {canViewBossReport && (
            <NavLink
              to="/boss"
              className={navLinkClass}
              onClick={handleNavClick}
            >
              <svg
                className="mr-3 shrink-0 text-red-400"
                style={{ width: "18px", height: "18px" }}
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
            </NavLink>
          )}

          {/* DIVIDER + LABEL */}
          <div className="pt-4 pb-1.5 px-1">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
              Kinh doanh
            </p>
          </div>

          <NavLink to="/crm" className={navLinkClass} onClick={handleNavClick}>
            <svg
              className="mr-3 shrink-0"
              style={{ width: "18px", height: "18px" }}
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
          </NavLink>

          <NavLink to="/kpi" className={navLinkClass} onClick={handleNavClick}>
            <svg
              className="mr-3 shrink-0"
              style={{ width: "18px", height: "18px" }}
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
          </NavLink>

          {canAccessProcessing && (
            <>
              <div className="pt-4 pb-1.5 px-1">
                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                  Nghiệp vụ
                </p>
              </div>
              <NavLink
                to="/processing"
                className={navLinkClass}
                onClick={handleNavClick}
              >
                <svg
                  className="mr-3 shrink-0"
                  style={{ width: "18px", height: "18px" }}
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
              </NavLink>
              <NavLink
                to="/processed-docs"
                className={navLinkClass}
                onClick={handleNavClick}
              >
                <svg
                  className="mr-3 shrink-0"
                  style={{ width: "18px", height: "18px" }}
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
              </NavLink>
              <NavLink
                to="/recruitment"
                className={navLinkClass}
                onClick={handleNavClick}
              >
                <svg
                  className="mr-3 shrink-0"
                  style={{ width: "18px", height: "18px" }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                Tiến độ Tuyển dụng
              </NavLink>
            </>
          )}

          {/* DIVIDER */}
          <div className="pt-4 pb-1.5 px-1">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
              Quản trị
            </p>
          </div>

          <NavLink
            to="/documents"
            className={navLinkClass}
            onClick={handleNavClick}
          >
            <svg
              className="mr-3 shrink-0"
              style={{ width: "18px", height: "18px" }}
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
          </NavLink>

          <NavLink to="/hr" className={navLinkClass} onClick={handleNavClick}>
            <svg
              className="mr-3 shrink-0"
              style={{ width: "18px", height: "18px" }}
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
          </NavLink>

          <NavLink
            to="/services"
            className={navLinkClass}
            onClick={handleNavClick}
          >
            <svg
              className="mr-3 shrink-0"
              style={{ width: "18px", height: "18px" }}
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
          </NavLink>
        </nav>

        {/* BOTTOM: SETTINGS + USER */}
        <div className="px-3 py-3 border-t border-gray-700/50 space-y-0.5">
          <NavLink
            to="/settings"
            className={navLinkClass}
            onClick={handleNavClick}
          >
            <svg
              className="mr-3 shrink-0"
              style={{ width: "18px", height: "18px" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Cài đặt
          </NavLink>

          {/* USER INFO */}
          <div className="flex items-center gap-2.5 px-3 py-2 mt-1 rounded-lg bg-gray-800/60">
            <FaceAvatar
              name={currentUser?.name || currentUser?.employeeCode || "user"}
              size={34}
              className="rounded-full"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-200 truncate">
                {currentUser?.name}
              </p>
              <p className="text-[10px] text-gray-500 truncate">
                {currentUser?.role}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
