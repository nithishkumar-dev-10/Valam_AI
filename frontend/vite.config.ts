import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The backend's dev CORS_ORIGINS whitelists http://localhost:5173, so the dev
// server stays on that port. With no VITE_API_BASE_URL, the app calls /api on
// its own origin; the proxy below forwards those calls to FastAPI so local dev
// behaves exactly like the same-origin production build. Keep the port in sync
// with backend/.env's CORS_ORIGINS if you change it, or set VITE_API_BASE_URL
// explicitly to call the backend cross-origin instead.
const devApiProxy = {
  "/api": {
    target: "http://localhost:8000",
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: devApiProxy,
  },
  preview: {
    port: 5173,
    proxy: devApiProxy,
  },
});