import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx' // Vite tự hiểu đuôi .tsx hoặc .ts

// Giảm log "Uncaught (in promise) undefined" từ extension trình duyệt (vd. Cursor onboarding) hoặc reject rỗng.
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason === undefined || event.reason === null) {
    event.preventDefault();
  }
});

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