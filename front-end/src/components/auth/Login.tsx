// frontend/components/auth/Login.tsx
import React, { useState } from "react";
import { Globe } from "@phosphor-icons/react";
import type { AuthUser } from "../../types";
import { API_URL } from "../../constants/config";

interface LoginProps {
  onLoginSuccess: (user: AuthUser) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Đăng nhập thất bại");
      localStorage.setItem("flyvisa_user", JSON.stringify(data));
      onLoginSuccess(data);
    } catch (err) {
      setError((err as Error).message || "Không thể kết nối đến máy chủ.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccessMessage(""); setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gửi yêu cầu thất bại");
      setSuccessMessage(data.message);
    } catch (err) {
      setError((err as Error).message || "Không thể kết nối đến máy chủ.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-orange-500 rounded-2xl shadow-md mb-4">
            <Globe size={28} color="white" weight="bold" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Fly Visa CRM</h1>
          <p className="text-slate-400 mt-1 text-sm font-medium">Hệ thống Quản trị Nội bộ</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          {mode === "login" ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3 mb-1">
                Đăng nhập hệ thống
              </h2>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-100">
                  ⚠️ {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email công ty</label>
                <input
                  type="email"
                  placeholder="example@flyvisa.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 text-sm rounded-lg px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 placeholder-slate-400 transition-colors"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-600">Mật khẩu</label>
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setError(""); setSuccessMessage(""); }}
                    className="text-xs text-orange-500 hover:text-orange-600 hover:underline transition-colors"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 text-sm rounded-lg px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 placeholder-slate-400 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-1 w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
              >
                {isLoading ? "Đang xác thực..." : "Đăng Nhập"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3 mb-1">
                Khôi phục mật khẩu
              </h2>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-100">
                  ⚠️ {error}
                </div>
              )}
              {successMessage && (
                <div className="p-3 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-lg border border-emerald-100 leading-relaxed">
                  ✅ {successMessage}
                </div>
              )}

              {!successMessage && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email tài khoản</label>
                    <input
                      type="email"
                      placeholder="example@flyvisa.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-slate-800 text-sm rounded-lg px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 placeholder-slate-400 transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                  >
                    {isLoading ? "Đang gửi..." : "Gửi yêu cầu khôi phục"}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); setSuccessMessage(""); }}
                className="text-sm text-slate-500 hover:text-slate-800 transition-colors text-center hover:underline"
              >
                Quay lại đăng nhập
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">© 2026 Fly Visa. All rights reserved.</p>
      </div>
    </div>
  );
};

export default Login;
