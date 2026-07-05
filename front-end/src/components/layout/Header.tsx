import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bell, List, X, SignOut, Warning, CaretDown } from "@phosphor-icons/react";
import { type AuthUser } from "../../types";
import socket from "../../services/socket";
import { FaceAvatar } from "../ui/FaceAvatar";
import { API_URL } from "../../constants/config";

interface HeaderProps {
  currentUser: AuthUser;
  onToggleSidebar?: () => void;
}

interface NotificationItem {
  id: string;
  sender: string;
  message: string;
  receiver: string;
  isRead: boolean;
  createdAt: string;
}

const Header: React.FC<HeaderProps> = ({ currentUser, onToggleSidebar }) => {
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const [latestToast, setLatestToast] = useState<NotificationItem | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const fetchNotifications = useCallback(async () => {
    if (!currentUser?.name) return;
    try {
      const res = await fetch(`${API_URL}/api/notifications/${currentUser.name}`);
      if (res.ok) {
        const data: NotificationItem[] = await res.json();
        if (data.length > prevCountRef.current && data.length > 0) {
          setLatestToast(data[0]);
          setTimeout(() => setLatestToast(null), 6000);
        }
        prevCountRef.current = data.length;
        setNotifications(data);
      }
    } catch (error) { console.error("Lỗi tải thông báo:", error); }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.name) {
      fetch(`${API_URL}/api/notifications/${currentUser.name}`)
        .then((r) => (r.ok ? (r.json() as Promise<NotificationItem[]>) : []))
        .then((data) => { prevCountRef.current = data.length; setNotifications(data); })
        .catch(console.error);
    }
    socket.on("new_notification", fetchNotifications);
    return () => { socket.off("new_notification", fetchNotifications); };
  }, [currentUser?.name, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setShowNotifs(false);
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setShowUserMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/notifications/${id}/read`, { method: "PUT" });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (notifications.length <= 1) setShowNotifs(false);
    } catch (error) { console.error("Lỗi đánh dấu:", error); }
  };

  const handleLogout = async () => {
    try { await fetch(`${API_URL}/api/auth/logout`, { method: "POST" }); } catch {}
    localStorage.removeItem("flyvisa_user");
    window.location.reload();
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 md:px-6 shrink-0 relative z-40">
      {/* LEFT: Hamburger (mobile only) */}
      <div className="flex items-center gap-2 lg:hidden">
        <button onClick={onToggleSidebar} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-lg transition-colors">
          <List size={22} />
        </button>
      </div>

      {/* CENTER: Notification */}
      <div className="flex-1 max-w-2xl mx-2 md:mx-4 lg:mx-8 relative" ref={notifRef}>
        {notifications.length > 0 ? (
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="w-full flex items-center justify-between bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-colors"
          >
            <div className="flex items-center overflow-hidden gap-2">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-red-700 font-bold text-xs shrink-0">
                <span className="hidden sm:inline">THÔNG BÁO ({notifications.length}):</span>
                <span className="sm:hidden">Lệnh ({notifications.length}):</span>
              </span>
              <span className="text-red-600 text-xs font-medium truncate">
                {notifications[0].sender}{" "}
                <span className="hidden sm:inline">vừa gửi một thông báo mới!</span>
              </span>
            </div>
            <CaretDown size={13} className={`text-red-400 shrink-0 ml-2 transition-transform ${showNotifs ? "rotate-180" : ""}`} />
          </button>
        ) : (
          <div className="w-full flex items-center justify-center gap-2 text-slate-400 text-xs italic py-2">
            <Bell size={14} />
            <span className="hidden sm:inline">Không có thông báo khẩn nào</span>
            <span className="sm:hidden">Không có thông báo</span>
          </div>
        )}

        {showNotifs && notifications.length > 0 && (
          <div className="absolute top-full left-0 right-0 md:right-auto mt-2 w-[calc(100vw-24px)] md:w-full max-w-lg bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden z-50">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
              <h4 className="font-bold text-slate-800 text-sm">Lệnh Điều Hành Chưa Đọc</h4>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((notif) => (
                <div key={notif.id} className="px-4 py-3 border-b border-slate-100 hover:bg-red-50 transition-colors flex justify-between items-start gap-3">
                  <div>
                    <p className="font-semibold text-xs text-slate-800 mb-1">👔 {notif.sender}</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>
                  </div>
                  <button
                    onClick={() => handleMarkAsRead(notif.id)}
                    className="shrink-0 bg-white border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Đã xem
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: User */}
      <div className="flex items-center gap-2 shrink-0 relative" ref={userMenuRef}>
        <div className="hidden flex-col items-end mr-1 md:flex">
          <span className="text-sm font-semibold text-slate-800">{currentUser?.name || "Người dùng"}</span>
          <span className="text-xs text-slate-400">{currentUser?.role || "Nhân viên"}</span>
        </div>
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-9 h-9 rounded-full overflow-hidden border-2 border-orange-200 bg-orange-50 hover:border-orange-400 transition-colors outline-none focus:ring-2 focus:ring-orange-300"
        >
          <FaceAvatar name={currentUser?.name || currentUser?.employeeCode || "user"} size={36} showInitial color="#ffff" />
        </button>

        {showUserMenu && (
          <div className="absolute top-full right-0 mt-2 w-44 bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden py-1 z-50">
            <div className="px-4 py-3 border-b border-slate-100 md:hidden">
              <p className="text-sm font-bold text-slate-800">{currentUser?.name}</p>
              <p className="text-xs text-slate-400">{currentUser?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 font-semibold hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <SignOut size={15} />
              Đăng xuất
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {latestToast && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:bottom-5 md:right-5 z-9999 flex justify-center">
          <div className="bg-white border-l-4 border-l-red-500 shadow-xl rounded-r-xl rounded-l-sm flex items-start p-4 pr-10 w-full max-w-sm relative">
            <div className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-red-100 text-red-500 mr-3">
              <Warning size={18} />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-bold text-red-700 uppercase tracking-wide">Từ: {latestToast.sender}</h4>
              <p className="text-xs text-slate-700 font-medium mt-0.5 leading-snug">{latestToast.message}</p>
            </div>
            <button onClick={() => setLatestToast(null)} className="absolute top-2 right-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5 transition-colors">
              <X size={13} />
            </button>
          </div>
        </div>
      )}
      <style>{`
        @keyframes bounce-short { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-bounce-short { animation: bounce-short 1s ease-in-out 3; }
      `}</style>
    </header>
  );
};

export default Header;
