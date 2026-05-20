import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx' // Vite tự hiểu đuôi .tsx hoặc .ts

import { API_URL } from "./constants/config";

// Giảm log "Uncaught (in promise) undefined" từ extension trình duyệt (vd. Cursor onboarding) hoặc reject rỗng.
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason === undefined || event.reason === null) {
    event.preventDefault();
  }
});

// Monkeypatch window.fetch để tự động gắn token Authorization khi gọi API
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  try {
    const urlString = typeof input === "string" ? input : (input && (input as Request).url) || "";
    const isApi = !/^(https?:)?\/\//i.test(urlString) || urlString.startsWith(API_URL);

    if (isApi) {
      const userJson = localStorage.getItem("flyvisa_user");
      if (userJson) {
        const user = JSON.parse(userJson);
        if (user && user.token) {
          init = init || {};
          const headers = new Headers(init.headers || {});
          if (!headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${user.token}`);
          }
          init.headers = headers;

          // Đảm bảo gửi credentials (cookie) nếu được cấu hình hoặc mặc định
          if (init.credentials === undefined) {
            init.credentials = "include";
          }
        }
      }
    }
  } catch (err) {
    console.error("Lỗi trong fetch interceptor:", err);
  }
  return originalFetch(input, init);
};

// Sử dụng Type Assertion "as HTMLElement" để khẳng định với TS rằng phần tử này chắc chắn tồn tại
const container = document.getElementById('root') as HTMLElement;

// Nếu bạn muốn an toàn tuyệt đối hơn theo chuẩn TS nghiêm ngặt:
if (!container) {
  throw new Error("Không tìm thấy phần tử root. Hãy kiểm tra lại index.html");
}

const root = createRoot(container);

root.render(
    <App />
);