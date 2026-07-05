import React, { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import {
  House, ChartBarHorizontal, UsersThree, ClipboardText,
  Briefcase, CheckCircle, UsersFour, FolderOpen, Clock,
  Gear, X, Globe,
  PencilSimple, Trash, Plus, CaretDown,
} from "@phosphor-icons/react";
import { FaceAvatar } from "../ui/FaceAvatar";
import type { SidebarProps, Workspace } from "../../types";
import api from "../../services/api";
import { hasPermission, P } from "../../utils/access";

type WsModalMode = "add" | "edit" | "manage" | null;

// Custom dropdown thay thế native <select> để tránh mũi tên kép
const WsDropdown: React.FC<{
  workspaces: Workspace[];
  activeId: string;
  onChange: (id: string) => void;
}> = ({ workspaces, activeId, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = workspaces.find((w) => w.id === activeId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-1.5 hover:border-orange-300 transition-colors outline-none"
      >
        <span className="truncate text-left">
          {active ? (active.url ? "↗ " : "") + active.name : "—"}
        </span>
        <CaretDown
          size={12}
          className={`ml-1.5 shrink-0 text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && workspaces.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-[70] overflow-hidden">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => { onChange(ws.id); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm truncate transition-colors ${
                ws.id === activeId
                  ? "bg-orange-50 text-orange-600 font-medium"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {ws.url ? "↗ " : ""}{ws.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const normalizeUrl = (rawUrl?: string): string | null => {
  if (!rawUrl?.trim()) return null;
  const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
  try { return new URL(withProtocol).toString(); } catch { return null; }
};

const isSameWorkspaceUrl = (workspaceUrl: string, currentUrl: string): boolean => {
  try {
    const ws = new URL(workspaceUrl);
    const cur = new URL(currentUrl);
    return ws.origin === cur.origin && cur.pathname.startsWith(ws.pathname);
  } catch { return false; }
};

// ── Tooltip cho nav item khi collapsed ──────────────────────────────────────
const NavItem: React.FC<{ collapsed: boolean; label: string; children: React.ReactNode }> = ({
  collapsed, label, children,
}) => (
  <div className={collapsed ? "relative group/tip" : ""}>
    {children}
    {collapsed && (
      <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 shadow-xl z-[9999]">
        {label}
      </span>
    )}
  </div>
);

// ── Section label ────────────────────────────────────────────────────────────
const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <div className="pt-5 pb-1.5 px-2">
    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
  </div>
);

const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  isOpen = false,
  onClose,
  collapsed = false,
  onToggleCollapse,
}) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>("");
  const [wsModal, setWsModal] = useState<WsModalMode>(null);
  const [wsFormName, setWsFormName] = useState("");
  const [wsFormUrl, setWsFormUrl] = useState("");
  const [wsError, setWsError] = useState("");
  const [wsSaving, setWsSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const workspacePrefKey = `flyvisa_active_workspace_${currentUser?.id ?? "unknown"}`;
  const [editingWs, setEditingWs] = useState<Workspace | null>(null);

  useEffect(() => {
    if (!currentUser?.id) return;
    api.get<Workspace[]>("/api/workspaces").then((res) => {
      const list = res.data;
      setWorkspaces(list);
      if (list.length === 0) return;
      const currentHref = window.location.href;
      const savedId = localStorage.getItem(workspacePrefKey);
      const matchedBySaved = list.find((ws) => ws.id === savedId);
      const matchedByUrl = list.find((ws) => {
        const n = normalizeUrl(ws.url);
        return n ? isSameWorkspaceUrl(n, currentHref) : false;
      });
      setActiveWorkspaceId(matchedBySaved?.id || matchedByUrl?.id || list[0].id);
    }).catch(() => {});
  }, [currentUser?.id, workspacePrefKey]);

  useEffect(() => {
    if (activeWorkspaceId) localStorage.setItem(workspacePrefKey, activeWorkspaceId);
  }, [activeWorkspaceId, workspacePrefKey]);

  useEffect(() => {
    if (wsModal && wsModal !== "manage") setTimeout(() => nameInputRef.current?.focus(), 50);
  }, [wsModal]);

  const showMainNav = hasPermission(currentUser, P.navDashboard);
  const canViewBossReport = hasPermission(currentUser, P.navBoss);
  const canAccessProcessing = hasPermission(currentUser, P.navProcessing);

  const openAddModal = () => { if (!showMainNav) return; setWsFormName(""); setWsFormUrl(""); setWsError(""); setWsModal("add"); };
  const openManageModal = () => { if (!showMainNav) return; setWsModal("manage"); };
  const startEdit = (ws: Workspace) => { setEditingWs(ws); setWsFormName(ws.name); setWsFormUrl(ws.url ?? ""); setWsError(""); setWsModal("edit"); };
  const closeModal = () => { setWsModal(null); setEditingWs(null); };

  const handleSaveAdd = async () => {
    const name = wsFormName.trim();
    if (!name) { setWsError("Tên không được để trống."); return; }
    setWsSaving(true);
    try {
      const res = await api.post<Workspace>("/api/workspaces", { name, url: wsFormUrl.trim() || undefined, employeeId: currentUser.id });
      setWorkspaces((prev) => [...prev, res.data]);
      setActiveWorkspaceId(res.data.id);
      closeModal();
    } catch (e) {
      setWsError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Lỗi khi tạo workspace");
    } finally { setWsSaving(false); }
  };

  const handleSaveEdit = async () => {
    if (!editingWs) return;
    const name = wsFormName.trim();
    if (!name) { setWsError("Tên không được để trống."); return; }
    setWsSaving(true);
    try {
      const res = await api.put<Workspace>(`/api/workspaces/${editingWs.id}`, { name, url: wsFormUrl.trim() || undefined, employeeId: currentUser.id });
      setWorkspaces((prev) => prev.map((w) => (w.id === editingWs.id ? res.data : w)));
      setWsModal("manage"); setEditingWs(null);
    } catch (e) {
      setWsError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Lỗi khi cập nhật");
    } finally { setWsSaving(false); }
  };

  const handleDelete = async (wsId: string) => {
    if (workspaces.length <= 1) { setWsError("Phải có ít nhất 1 không gian làm việc."); return; }
    if (!window.confirm("Bạn có chắc muốn xoá không gian này?")) return;
    setWsSaving(true);
    try {
      await api.delete(`/api/workspaces/${wsId}`, { data: { employeeId: currentUser.id } });
      const remaining = workspaces.filter((w) => w.id !== wsId);
      setWorkspaces(remaining);
      if (activeWorkspaceId === wsId) setActiveWorkspaceId(remaining[0].id);
    } catch (e) { alert("Lỗi khi xoá: " + e); }
    finally { setWsSaving(false); }
  };

  const handleWorkspaceChange = (wsId: string) => {
    const ws = workspaces.find((w) => w.id === wsId);
    if (!ws) return;
    const normalized = normalizeUrl(ws.url);
    if (normalized && !isSameWorkspaceUrl(normalized, window.location.href)) {
      window.open(normalized, "_blank"); return;
    }
    setActiveWorkspaceId(wsId);
  };

  const handleNavClick = () => { if (onClose) onClose(); };

  // ── Nav link class generator ────────────────────────────────────────────────
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    collapsed
      ? `w-full flex items-center justify-center py-2.5 rounded-lg transition-all duration-150 ${
          isActive
            ? "bg-orange-50 text-orange-500"
            : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"
        }`
      : `w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-150 truncate ${
          isActive
            ? "bg-orange-50 text-orange-600 border-r-2 border-orange-500 pr-[10px]"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        }`;

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm" onClick={onClose} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 bg-white border-r border-slate-200 flex flex-col z-50 overflow-x-hidden min-w-0
          transform transition-[transform,width] duration-300 ease-in-out
          lg:relative lg:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          ${collapsed ? "lg:w-16" : "lg:w-64"}
          w-64`}
      >
        {/* ── LOGO ─────────────────────────────────────────────────────────── */}
        <div className={`flex items-center border-b border-slate-200 shrink-0 h-16 ${collapsed ? "justify-center px-0" : "justify-between px-4"}`}>
          {collapsed ? (
            <button
              onClick={onToggleCollapse}
              title="Mở rộng menu"
              className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center hover:bg-orange-600 transition-colors shadow-sm"
            >
              <Globe size={18} color="white" weight="bold" />
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={onToggleCollapse}
                  title="Thu/Mở menu"
                  className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center shadow-sm shrink-0 hover:bg-orange-600 transition-colors hidden lg:flex"
                >
                  <Globe size={16} color="white" weight="bold" />
                </button>
                <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center shadow-sm shrink-0 lg:hidden">
                  <Globe size={16} color="white" weight="bold" />
                </div>
                <div>
                  <span className="font-black text-slate-900 text-sm tracking-tight">Fly Visa</span>
                  <p className="text-[10px] text-slate-400 leading-none font-medium tracking-wide">Management System</p>
                </div>
              </div>
              <button onClick={onClose} className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </>
          )}
        </div>

        {/* ── WORKSPACE ────────────────────────────────────────────────────── */}
        {showMainNav && !collapsed && (
          <div className="px-3 py-3 border-b border-slate-100">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">
              Không gian làm việc
            </p>
            <div className="flex items-center gap-1.5">
              <WsDropdown
                workspaces={workspaces}
                activeId={activeWorkspaceId}
                onChange={handleWorkspaceChange}
              />
              <button onClick={openManageModal} title="Quản lý" className="w-7 h-7 flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors shrink-0 text-slate-500 hover:text-slate-700">
                <PencilSimple size={13} />
              </button>
              <button onClick={openAddModal} title="Thêm" className="w-7 h-7 flex items-center justify-center bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-300 rounded-lg transition-colors shrink-0 text-slate-500 hover:text-orange-500">
                <Plus size={13} />
              </button>
            </div>
          </div>
        )}

        {/* ── WORKSPACE MODAL ──────────────────────────────────────────────── */}
        {wsModal && (
          <div className="absolute inset-0 z-[60] flex items-start justify-center bg-slate-900/40 backdrop-blur-sm pt-20">
            <div className="w-[calc(100%-24px)] bg-white rounded-xl shadow-xl border border-slate-200 p-4 max-h-[70vh] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-800">
                  {wsModal === "add" ? "Thêm không gian" : wsModal === "edit" ? "Sửa không gian" : "Quản lý không gian"}
                </h3>
                <button onClick={closeModal} className="text-slate-400 hover:text-slate-700 p-1 hover:bg-slate-100 rounded-lg transition-colors">
                  <X size={15} />
                </button>
              </div>

              {wsModal === "manage" ? (
                <div className="space-y-2 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                  {workspaces.map((ws) => (
                    <div key={ws.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${ws.id === activeWorkspaceId ? "bg-orange-50 border-orange-200" : "bg-slate-50 border-slate-200"}`}>
                      <div className="min-w-0 flex-1 mr-2">
                        <div className="flex items-center gap-1.5">
                          {ws.id === activeWorkspaceId && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                          <p className="text-xs font-semibold text-slate-700 truncate">{ws.name}</p>
                        </div>
                        {ws.url && <p className="text-[10px] text-slate-400 truncate mt-0.5">{ws.url}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(ws)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                          <PencilSimple size={13} />
                        </button>
                        <button onClick={() => handleDelete(ws.id)} disabled={wsSaving} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button onClick={openAddModal} className="w-full py-2 flex items-center justify-center gap-1.5 border border-dashed border-slate-300 hover:border-orange-400 text-slate-400 hover:text-orange-500 rounded-lg transition-all text-xs font-medium">
                    <Plus size={13} /> Thêm không gian mới
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-slate-500 mb-1.5 block font-medium">Tên không gian</label>
                    <input ref={nameInputRef} type="text" value={wsFormName}
                      onChange={(e) => { setWsFormName(e.target.value); setWsError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && (wsModal === "add" ? handleSaveAdd() : handleSaveEdit())}
                      placeholder="VD: Fly Visa EDU"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg px-3 py-2 outline-none focus:border-orange-400 focus:bg-white placeholder-slate-400 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 mb-1.5 block font-medium">Link website <span className="text-slate-400 font-normal">(tuỳ chọn)</span></label>
                    <input type="url" value={wsFormUrl}
                      onChange={(e) => setWsFormUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (wsModal === "add" ? handleSaveAdd() : handleSaveEdit())}
                      placeholder="https://example.com"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg px-3 py-2 outline-none focus:border-orange-400 focus:bg-white placeholder-slate-400 transition-colors"
                    />
                  </div>
                  {wsError && <p className="text-xs text-red-500 font-medium">{wsError}</p>}
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={wsModal === "add" ? handleSaveAdd : handleSaveEdit} disabled={wsSaving}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                      {wsSaving ? "Đang lưu..." : wsModal === "add" ? "Thêm" : "Lưu thay đổi"}
                    </button>
                    <button onClick={wsModal === "edit" ? () => setWsModal("manage") : closeModal} disabled={wsSaving}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 text-sm font-medium py-2 rounded-lg transition-colors">
                      {wsModal === "edit" ? "Quay lại" : "Huỷ"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── NAV CHÍNH ────────────────────────────────────────────────────── */}
        <nav className={`flex-1 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden custom-scrollbar ${collapsed ? "px-2" : "px-3"}`}>

          {showMainNav && hasPermission(currentUser, P.navDashboard) && (
            <NavItem collapsed={collapsed} label="Tổng quan">
              <NavLink to="/dashboard" className={navLinkClass} onClick={handleNavClick}>
                <House size={18} weight="regular" />{!collapsed && "Tổng quan"}
              </NavLink>
            </NavItem>
          )}

          {canViewBossReport && showMainNav && (
            <NavItem collapsed={collapsed} label="Báo cáo Giám đốc">
              <NavLink to="/boss" className={navLinkClass} onClick={handleNavClick}>
                <ChartBarHorizontal size={18} weight="regular" className="text-rose-400" />
                {!collapsed && <span>Báo cáo Giám đốc</span>}
              </NavLink>
            </NavItem>
          )}

          {/* Nhóm Kinh doanh */}
          {!collapsed && showMainNav && <SectionLabel label="Kinh doanh" />}
          {collapsed && showMainNav && <div className="my-2 border-t border-slate-100" />}

          {showMainNav && hasPermission(currentUser, P.navCrm) && (
            <NavItem collapsed={collapsed} label="Quản lý Khách hàng">
              <NavLink to="/crm" className={navLinkClass} onClick={handleNavClick}>
                <UsersThree size={18} weight="regular" />{!collapsed && "Quản lý Khách hàng"}
              </NavLink>
            </NavItem>
          )}

          {showMainNav && hasPermission(currentUser, P.navKpi) && (
            <NavItem collapsed={collapsed} label="Giao việc tuần">
              <NavLink to="/kpi" className={navLinkClass} onClick={handleNavClick}>
                <ClipboardText size={18} weight="regular" />{!collapsed && "Giao việc tuần"}
              </NavLink>
            </NavItem>
          )}

          {/* Nhóm Nghiệp vụ */}
          {canAccessProcessing && showMainNav && (
            <>
              {!collapsed && <SectionLabel label="Nghiệp vụ" />}
              {collapsed && <div className="my-2 border-t border-slate-100" />}

              <NavItem collapsed={collapsed} label="Xử lý hồ sơ">
                <NavLink to="/processing" className={navLinkClass} onClick={handleNavClick}>
                  <Briefcase size={18} weight="regular" />{!collapsed && "Xử lý hồ sơ"}
                </NavLink>
              </NavItem>

              <NavItem collapsed={collapsed} label="Hồ sơ Đã xử lý">
                <NavLink to="/processed-docs" className={navLinkClass} onClick={handleNavClick}>
                  <CheckCircle size={18} weight="regular" />{!collapsed && "Hồ sơ Đã xử lý"}
                </NavLink>
              </NavItem>

              <NavItem collapsed={collapsed} label="Tiến độ Tuyển dụng">
                <NavLink to="/recruitment" className={navLinkClass} onClick={handleNavClick}>
                  <UsersFour size={18} weight="regular" />{!collapsed && "Tiến độ Tuyển dụng"}
                </NavLink>
              </NavItem>
            </>
          )}

          {/* Nhóm Quản trị */}
          {!collapsed && showMainNav && <SectionLabel label="Quản trị" />}
          {collapsed && showMainNav && <div className="my-2 border-t border-slate-100" />}

          {showMainNav && hasPermission(currentUser, P.navDocuments) && (
            <NavItem collapsed={collapsed} label="Tài liệu công ty">
              <NavLink to="/documents" className={navLinkClass} onClick={handleNavClick}>
                <FolderOpen size={18} weight="regular" />{!collapsed && "Tài liệu công ty"}
              </NavLink>
            </NavItem>
          )}

          {hasPermission(currentUser, P.navHr) && (
            <NavItem collapsed={collapsed} label="Chấm công">
              <NavLink to="/hr" className={navLinkClass} onClick={handleNavClick}>
                <Clock size={18} weight="regular" />{!collapsed && "Chấm công"}
              </NavLink>
            </NavItem>
          )}

        </nav>

        {/* ── BOTTOM: Settings + User ───────────────────────────────────────── */}
        <div className={`py-3 border-t border-slate-100 space-y-0.5 ${collapsed ? "px-2" : "px-3"}`}>
          {hasPermission(currentUser, P.navSettings) && (
            <NavItem collapsed={collapsed} label="Cài đặt">
              <NavLink to="/settings" className={navLinkClass} onClick={handleNavClick}>
                <Gear size={18} weight="regular" />{!collapsed && "Cài đặt"}
              </NavLink>
            </NavItem>
          )}

          {/* User info */}
          <div className={`flex items-center mt-2 rounded-xl bg-slate-50 border border-slate-100 ${collapsed ? "justify-center p-2" : "gap-2.5 px-3 py-2.5"}`}>
            <FaceAvatar name={currentUser?.name || currentUser?.employeeCode || "user"} size={32} className="rounded-full shrink-0" />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 truncate">{currentUser?.name}</p>
                <p className="text-[10px] text-slate-400 truncate font-medium">{currentUser?.role}</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
