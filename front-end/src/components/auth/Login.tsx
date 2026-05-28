// frontend/components/auth/Login.tsx
import React, { useState } from "react";
import { Card, TextInput, Label, Button } from "flowbite-react";
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
      // Gọi API login riêng
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include", // QUAN TRỌNG: để gửi cookie
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Đăng nhập thất bại");
      }

      // THÊM DÒNG NÀY ĐỂ LƯU TÀI KHOẢN VÀO TRÌNH DUYỆT
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
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gửi yêu cầu thất bại");
      }

      setSuccessMessage(data.message);
    } catch (err) {
      setError((err as Error).message || "Không thể kết nối đến máy chủ.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
      <div className="w-full max-w-md p-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-500 text-white rounded-full shadow-lg mb-4">
            <svg
              className="w-10 h-10"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              ></path>
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-800">
            Fly Visa CRM
          </h1>
          <p className="text-gray-500 mt-2 font-medium">
            Hệ thống Quản trị Nội bộ
          </p>
        </div>

        <Card className="shadow-xl border-none rounded-2xl">
          {mode === "login" ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-5 p-2">
              <h2 className="text-xl font-bold text-gray-800 border-b pb-2">
                Đăng nhập hệ thống
              </h2>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-100">
                  ⚠️ {error}
                </div>
              )}

              <div>
                <div className="mb-2 block">
                  <Label>Email công ty</Label>
                </div>
                <TextInput
                  type="email"
                  placeholder="example@flyvisa.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <div className="mb-2 flex justify-between">
                  <Label>Mật Khẩu</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setError("");
                      setSuccessMessage("");
                    }}
                    className="text-xs text-orange-500 hover:underline bg-transparent border-none cursor-pointer p-0"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <TextInput
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="mt-2 bg-orange-500 hover:bg-orange-600 focus:ring-4 focus:ring-orange-200"
              >
                {isLoading ? "Đang xác thực..." : "Đăng Nhập"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="flex flex-col gap-5 p-2">
              <h2 className="text-xl font-bold text-gray-800 border-b pb-2">
                Khôi phục mật khẩu
              </h2>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-100">
                  ⚠️ {error}
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-green-50 text-green-700 text-sm font-medium rounded-lg border border-green-100 leading-relaxed">
                  ✅ {successMessage}
                </div>
              )}

              {!successMessage && (
                <>
                  <div>
                    <div className="mb-2 block">
                      <Label>Nhập Email tài khoản của bạn</Label>
                    </div>
                    <TextInput
                      type="email"
                      placeholder="example@flyvisa.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="mt-2 bg-orange-500 hover:bg-orange-600 focus:ring-4 focus:ring-orange-200"
                  >
                    {isLoading ? "Đang gửi yêu cầu..." : "Gửi yêu cầu khôi phục"}
                  </Button>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setSuccessMessage("");
                }}
                className="text-center text-sm text-gray-500 hover:text-gray-800 bg-transparent border-none cursor-pointer mt-2 hover:underline"
              >
                Quay lại đăng nhập
              </button>
            </form>
          )}
        </Card>

        <p className="text-center text-sm text-gray-400 mt-6">
          © 2026 Fly Visa. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
