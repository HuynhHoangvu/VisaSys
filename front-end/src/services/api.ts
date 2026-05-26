import axios from "axios";
import { API_URL } from "../constants/config";

// Event emitter để thông báo khi cần đăng nhập lại
export const authEvents = {
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },
  emit() {
    this.listeners.forEach((listener) => listener());
  },
};

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  try {
    const userJson = localStorage.getItem("flyvisa_user");
    if (userJson) {
      const user = JSON.parse(userJson);
      if (user && user.token) {
        config.headers.Authorization = `Bearer ${user.token}`;
      }
    }
  } catch (err) {
    console.error("Error attaching auth token to request", err);
  }
  return config;
});

// Response interceptor để bắt lỗi 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Nếu lỗi 401 và chưa thử refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Thử refresh token
        const response = await axios.post(
          `${API_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );
        
        // Lưu user mới
        localStorage.setItem("flyvisa_user", JSON.stringify(response.data));
        
        // Retry request gốc với token mới
        originalRequest.headers.Authorization = `Bearer ${response.data.token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh thất bại → cần đăng nhập lại
        localStorage.removeItem("flyvisa_user");
        authEvents.emit();
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
