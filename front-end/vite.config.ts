import path from "path";
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    hmr: {
      // Khi chạy sau Nginx proxy (VITE_HMR_PORT=443), HMR dùng cổng 443
      // Khi chạy local trực tiếp, để mặc định
      ...(process.env.VITE_HMR_PORT
        ? { clientPort: Number(process.env.VITE_HMR_PORT) }
        : {}),
    },
  },
})
