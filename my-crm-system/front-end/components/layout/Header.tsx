import React, { useState, useEffect, useRef, useCallback } from "react";
import { type AuthUser } from "../../types"; // Sửa lại đường dẫn nếu cần
import { io } from "socket.io-client";


interface HeaderProps {
  currentUser: AuthUser;
}

interface NotificationItem {
  id: string;
  sender: string;
  message: string;
  receiver: string;
  isRead: boolean;
  createdAt: string;
}

const socket = io("http://localhost:3001");

const Header: React.FC<HeaderProps> = ({ currentUser }) => {
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  // State quản lý việc hiển thị Popup góc phải dưới
  const [latestToast, setLatestToast] = useState<NotificationItem | null>(null);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // ==========================================
  // HÀM LẤY THÔNG BÁO TỪ BACKEND
  // ==========================================
  const fetchNotifications = useCallback(async () => {
    if (!currentUser?.name) return;
    try {
      const res = await fetch(
        `http://localhost:3001/api/notifications/${currentUser.name}`,
      );
      if (res.ok) {
        const data: NotificationItem[] = await res.json();

        // KIỂM TRA NẾU CÓ THÔNG BÁO MỚI -> HIỆN POPUP TỰ ĐỘNG
        if (data.length > notifications.length && data.length > 0) {
          setLatestToast(data[0]);

          // Tự tắt popup sau 6 giây để không làm phiền người dùng
          setTimeout(() => setLatestToast(null), 6000);
        }

        setNotifications(data);
      }
    } catch (error) {
      console.error("Lỗi tải thông báo:", error);
    }
  }, [currentUser, notifications.length]);

  // ==========================================
  // LẮNG NGHE SỰ KIỆN TỪ SOCKET SERVER
  // ==========================================
  useEffect(() => {
    // Bọc trong 1 hàm ẩn danh để Linter không báo lỗi "synchronous setState"
    const loadData = async () => {
      await fetchNotifications();
    };

    loadData();

    // Lắng nghe socket
    const handleDataChange = () => {
      loadData();
    };

    socket.on("data_changed", handleDataChange);

    return () => {
      socket.off("data_changed", handleDataChange);
    };
  }, [fetchNotifications]);
  // ==========================================
  // ĐÓNG MENU KHI CLICK RA NGOÀI
  // ==========================================
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
      await fetch(`http://localhost:3001/api/notifications/${id}/read`, {
        method: "PUT",
      });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (notifications.length <= 1) setShowNotifs(false);
    } catch (error) {
      console.error("Lỗi đánh dấu đã đọc:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("http://localhost:3001/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.log("Lỗi gọi API Đăng xuất:", error);
    }
    localStorage.removeItem("flyvisa_user");
    window.location.reload();
  };

  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-6 shrink-0 shadow-sm relative z-50">
      {/* TRÁI: TIÊU ĐỀ */}
      <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap hidden lg:block">
        Fly Visa System
      </h2>

      {/* GIỮA: BIỂN BÁO LỆNH ĐIỀU HÀNH */}
      <div className="flex-1 max-w-2xl mx-4 lg:mx-8 relative" ref={notifRef}>
        {notifications.length > 0 ? (
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="w-full flex items-center justify-between bg-red-50 hover:bg-red-100 border border-red-200 px-4 py-2 rounded-lg transition-colors group"
          >
            <div className="flex items-center overflow-hidden">
              <span className="relative flex h-3 w-3 mr-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-red-700 font-bold mr-2 shrink-0">
                THÔNG BÁO ({notifications.length}):
              </span>
              <span className="text-red-600 text-sm font-medium truncate text-left">
                {notifications[0].sender} vừa gửi lệnh điều hành khẩn!
              </span>
            </div>
            <div className="flex items-center shrink-0 ml-2">
              <svg
                className={`w-5 h-5 text-red-500 ml-1 transition-transform ${showNotifs ? "rotate-180" : ""}`}
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
          <div className="w-full flex items-center justify-center text-gray-400 text-sm italic py-2">
            Không có thông báo khẩn nào
          </div>
        )}

        {/* DROPDOWN DANH SÁCH LỆNH CHƯA ĐỌC */}
        {showNotifs && notifications.length > 0 && (
          <div className="absolute top-full left-0 mt-2 w-full bg-white border border-gray-200 shadow-xl rounded-lg overflow-hidden flex flex-col">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex justify-between items-center">
              <h4 className="font-bold text-gray-800">
                Lệnh Điều Hành Chưa Đọc
              </h4>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="px-4 py-4 border-b border-gray-100 hover:bg-red-50 transition-colors flex justify-between items-center gap-4"
                >
                  <div>
                    <div className="flex items-center mb-1">
                      <span className="font-bold text-sm text-gray-900 flex items-center gap-1">
                        👔 {notif.sender}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed font-medium">
                      {notif.message}
                    </p>
                  </div>
                  <button
                    onClick={() => handleMarkAsRead(notif.id)}
                    className="shrink-0 bg-white border border-gray-300 text-gray-600 hover:text-green-600 hover:border-green-500 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm"
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
        className="flex items-center space-x-4 shrink-0 relative"
        ref={userMenuRef}
      >
        <div className="flex flex-col items-end mr-2 md:flex">
          <span className="text-sm font-bold text-gray-800">
            {currentUser?.name || "Người dùng"}
          </span>
          <span className="text-xs font-medium text-gray-500">
            {currentUser?.role || "Nhân viên"}
          </span>
        </div>

        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-10 h-10 bg-orange-100 text-orange-600 border border-orange-200 font-bold rounded-full flex items-center justify-center shadow-sm uppercase hover:bg-orange-200 transition-colors outline-none focus:ring-2 focus:ring-orange-300"
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

      {/* POPUP THÔNG BÁO GÓC MÀN HÌNH (DÙNG TAILWIND THUẦN TÚY) */}
      {latestToast && (
        <div className="fixed bottom-5 right-5 z-[9999] animate-bounce-short">
          <div className="bg-white border-l-4 border-l-red-500 shadow-2xl rounded-r-lg flex items-start p-4 pr-10 max-w-sm w-full relative">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-500 mr-3">
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                ></path>
              </svg>
            </div>

            <div className="flex-1">
              <h4 className="text-sm font-bold text-red-700 uppercase tracking-wide">
                Lệnh mới từ {latestToast.sender}
              </h4>
              <p className="text-sm text-gray-800 font-medium mt-1 leading-snug">
                {latestToast.message}
              </p>
            </div>

            {/* Nút X tự chế bằng Tailwind */}
            <button
              onClick={() => setLatestToast(null)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg p-1.5 transition-colors"
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
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Hiệu ứng animate-bounce-short tùy chỉnh */}
      <style>{`
        @keyframes bounce-short {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-short {
          animation: bounce-short 1s ease-in-out 3;
        }
      `}</style>
    </header>
  );
};

export default Header;
