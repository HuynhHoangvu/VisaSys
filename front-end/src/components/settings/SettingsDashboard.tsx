import React, { useState } from "react";
import type { AuthUser } from "../../types";
import { canManageRbac } from "../../utils/access";
import RbacSettingsPanel from "./RbacSettingsPanel";
import { API_URL } from "../../constants/config";

interface SettingsDashboardProps {
  currentUser: AuthUser;
  onUserRefresh?: (user: AuthUser) => void;
}

const SettingsDashboard: React.FC<SettingsDashboardProps> = ({
  currentUser,
  onUserRefresh,
}) => {
  const [mainTab, setMainTab] = useState<"security" | "rbac">("security");
  const showRbacTab = canManageRbac(currentUser);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwStatus, setPwStatus] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwStatus({ type: "error", msg: "Mật khẩu mới không khớp." });
      return;
    }
    if (newPassword.length < 6) {
      setPwStatus({
        type: "error",
        msg: "Mật khẩu mới phải có ít nhất 6 ký tự.",
      });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          employeeCode: currentUser.employeeCode,
          oldPassword,
          newPassword,
        }),
      });
      if (res.ok) {
        setPwStatus({ type: "success", msg: "Đổi mật khẩu thành công!" });
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json().catch(() => ({}));
        setPwStatus({
          type: "error",
          msg: data.message || "Mật khẩu cũ không đúng.",
        });
      }
    } catch {
      setPwStatus({
        type: "error",
        msg: "Lỗi kết nối máy chủ. Vui lòng thử lại.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Cài đặt</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {mainTab === "security"
            ? "Đổi mật khẩu và thông tin phiên bản ứng dụng"
            : "Phân quyền theo bộ phận và ghi đè từng nhân viên"}
        </p>
      </div>

      {showRbacTab && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMainTab("security")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mainTab === "security"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            Bảo mật
          </button>
          <button
            type="button"
            onClick={() => setMainTab("rbac")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mainTab === "rbac"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            Phân quyền (RBAC)
          </button>
        </div>
      )}

      {mainTab === "rbac" && showRbacTab ? (
        <RbacSettingsPanel
          onSelfPermissionsUpdated={(u) => {
            onUserRefresh?.(u);
          }}
        />
      ) : (
        <div className="max-w-2xl space-y-5">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Đổi mật khẩu</h3>
                <p className="text-xs text-gray-500">
                  Cập nhật mật khẩu đăng nhập
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Mật khẩu hiện tại
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  placeholder="Nhập mật khẩu hiện tại"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Mật khẩu mới
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
                />
              </div>

              {pwStatus && (
                <div
                  className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${
                    pwStatus.type === "success"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {pwStatus.type === "success" ? (
                    <svg
                      className="w-4 h-4 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                      />
                    </svg>
                  )}
                  {pwStatus.msg}
                </div>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Đang lưu...
                  </>
                ) : (
                  "Lưu mật khẩu mới"
                )}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Thông tin hệ thống</h3>
                <p className="text-xs text-gray-500">
                  Phiên bản và thông tin kỹ thuật
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Ứng dụng", value: "Fly Visa System" },
                { label: "Phiên bản", value: "v1.0.0" },
                { label: "Giao thức", value: "Real-time (Socket.io)" },
                { label: "Lưu trữ", value: "Cloudinary + MongoDB" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-gray-800">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsDashboard;
