import React, { useState, useEffect, useRef, useCallback } from "react";
import { type AuthUser } from "../../types";
import { io } from "socket.io-client";

interface HeaderProps {
  currentUser: AuthUser;
  onToggleSidebar?: () => void; // Thêm prop để mở Sidebar trên mobile
}

interface NotificationItem {
  id: string;
  sender: string;
  message: string;
  receiver: string;
  isRead: boolean;
  createdAt: string;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const socket = io(API_URL);

const Header: React.FC<HeaderProps> = ({ currentUser, onToggleSidebar }) => {
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const [latestToast, setLatestToast] = useState<NotificationItem | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!currentUser?.name) return;
    try {
      const res = await fetch(
        `${API_URL}/api/notifications/${currentUser.name}`,
      );
      if (res.ok) {
        const data: NotificationItem[] = await res.json();
        if (data.length > notifications.length && data.length > 0) {
          setLatestToast(data[0]);
          setTimeout(() => setLatestToast(null), 6000);
        }
        setNotifications(data);
      }
    } catch (error) {
      console.error("Lỗi tải thông báo:", error);
    }
  }, [currentUser, notifications.length]);

  useEffect(() => {
    const loadData = async () => {
      await fetchNotifications();
    };
    loadData();
    const handleDataChange = () => {
      loadData();
    };
    socket.on("data_changed", handleDataChange);
    return () => {
      socket.off("data_changed", handleDataChange);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notifRef.current &&
        !notifRef.current.contains(event.target as Node)
      ) {
        setShowNotifs(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/notifications/${id}/read`, { method: "PUT" });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (notifications.length <= 1) setShowNotifs(false);
    } catch (error) {
      console.error("Lỗi đánh dấu đã đọc:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: "POST" });
    } catch (error) {
      console.log("Lỗi gọi API Đăng xuất:", error);
    }
    localStorage.removeItem("flyvisa_user");
    window.location.reload();
  };

  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-3 md:px-6 shrink-0 shadow-sm relative z-40">
      {/* NÚT HAMBURGER MENU (Chỉ hiện trên mobile) */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        {/* TRÁI: TIÊU ĐỀ */}
        <div className="hidden lg:flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-gray-800 whitespace-nowrap">Fly Visa System</h2>
        </div>
      </div>

      {/* GIỮA: BIỂN BÁO LỆNH ĐIỀU HÀNH */}
      <div
        className="flex-1 max-w-2xl mx-2 md:mx-4 lg:mx-8 relative"
        ref={notifRef}
      >
        {notifications.length > 0 ? (
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="w-full flex items-center justify-between bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-colors group"
          >
            <div className="flex items-center overflow-hidden">
              <span className="relative flex h-2.5 w-2.5 md:h-3 md:w-3 mr-2 md:mr-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 md:h-3 md:w-3 bg-red-500"></span>
              </span>
              <span className="text-red-700 font-bold text-xs md:text-sm mr-1.5 md:mr-2 shrink-0">
                <span className="hidden sm:inline">
                  THÔNG BÁO ({notifications.length}):
                </span>
                <span className="sm:hidden text-[10px] uppercase">
                  Lệnh ({notifications.length}):
                </span>
              </span>
              <span className="text-red-600 text-[11px] md:text-sm font-medium truncate text-left">
                {notifications[0].sender}{" "}
                <span className="hidden sm:inline">
                  vừa gửi một thông báo mới!
                </span>
              </span>
            </div>
            <div className="flex items-center shrink-0 ml-1 md:ml-2">
              <svg
                className={`w-4 h-4 md:w-5 md:h-5 text-red-500 transition-transform ${showNotifs ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                ></path>
              </svg>
            </div>
          </button>
        ) : (
          <div className="w-full flex items-center justify-center gap-2 text-gray-400 text-xs md:text-sm italic py-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="hidden sm:inline">Không có thông báo khẩn nào</span>
            <span className="sm:hidden">Không có thông báo</span>
          </div>
        )}

        {/* DROPDOWN DANH SÁCH LỆNH CHƯA ĐỌC */}
        {showNotifs && notifications.length > 0 && (
          <div className="absolute top-full left-0 right-0 md:right-auto mt-2 w-[calc(100vw-24px)] md:w-full max-w-lg bg-white border border-gray-200 shadow-xl rounded-lg overflow-hidden flex flex-col z-50">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex justify-between items-center">
              <h4 className="font-bold text-gray-800 text-sm md:text-base">
                Lệnh Điều Hành Chưa Đọc
              </h4>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="px-3 py-3 md:px-4 md:py-4 border-b border-gray-100 hover:bg-red-50 transition-colors flex justify-between items-center gap-2 md:gap-4"
                >
                  <div>
                    <div className="flex items-center mb-1">
                      <span className="font-bold text-xs md:text-sm text-gray-900 flex items-center gap-1">
                        👔 {notif.sender}
                      </span>
                    </div>
                    <p className="text-xs md:text-sm text-gray-700 leading-relaxed font-medium">
                      {notif.message}
                    </p>
                  </div>
                  <button
                    onClick={() => handleMarkAsRead(notif.id)}
                    className="shrink-0 bg-white border border-gray-300 text-gray-600 hover:text-green-600 hover:border-green-500 text-[10px] md:text-xs font-bold px-2 py-1 md:px-3 md:py-1.5 rounded-lg transition-colors shadow-sm"
                  >
                    Đã xem
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* PHẢI: AVATAR USER VÀ ĐĂNG XUẤT */}
      <div
        className="flex items-center space-x-2 md:space-x-4 shrink-0 relative"
        ref={userMenuRef}
      >
        <div className="hidden flex-col items-end mr-2 md:flex">
          <span className="text-sm font-bold text-gray-800">
            {currentUser?.name || "Người dùng"}
          </span>
          <span className="text-xs font-medium text-gray-500">
            {currentUser?.role || "Nhân viên"}
          </span>
        </div>

        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-8 h-8 md:w-10 md:h-10 bg-orange-100 text-orange-600 border border-orange-200 font-bold text-sm md:text-base rounded-full flex items-center justify-center shadow-sm uppercase hover:bg-orange-200 transition-colors outline-none focus:ring-2 focus:ring-orange-300"
        >
          {currentUser?.employeeCode?.substring(0, 2) || "AD"}
        </button>

        {showUserMenu && (
          <div className="absolute top-full right-0 mt-3 w-48 bg-white border border-gray-100 shadow-xl rounded-lg overflow-hidden py-1 z-50">
            <div className="px-4 py-3 border-b border-gray-100 md:hidden">
              <p className="text-sm font-bold text-gray-800">
                {currentUser?.name}
              </p>
              <p className="text-xs text-gray-500">{currentUser?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 font-bold hover:bg-red-50 transition-colors flex items-center gap-2"
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
                  strokeWidth="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                ></path>
              </svg>
              Đăng xuất
            </button>
          </div>
        )}
      </div>

      {/* POPUP THÔNG BÁO GÓC MÀN HÌNH - TỐI ƯU MOBILE */}
      {latestToast && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:bottom-5 md:right-5 z-9999 animate-bounce-short flex justify-center">
          <div className="bg-white border-l-4 border-l-red-500 shadow-2xl rounded-r-lg rounded-l-md flex items-start p-3 md:p-4 pr-8 md:pr-10 w-full max-w-sm relative">
            <div className="inline-flex h-8 w-8 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-500 mr-2 md:mr-3">
              <svg
                className="w-5 h-5 md:w-6 md:h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                ></path>
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-xs md:text-sm font-bold text-red-700 uppercase tracking-wide">
                Từ: {latestToast.sender}
              </h4>
              <p className="text-xs md:text-sm text-gray-800 font-medium mt-0.5 md:mt-1 leading-snug">
                {latestToast.message}
              </p>
            </div>
            <button
              onClick={() => setLatestToast(null)}
              className="absolute top-1 right-1 md:top-2 md:right-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg p-1.5 transition-colors"
            >
              <svg
                className="w-3.5 h-3.5 md:w-4 md:h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </button>
          </div>
        </div>
      )}
      <style>{`
        @keyframes bounce-short {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-short { animation: bounce-short 1s ease-in-out 3; }
      `}</style>
    </header>
  );
};

export default Header;
