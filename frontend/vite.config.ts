import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The backend's default CORS_ORIGINS whitelists http://localhost:5173, so the
// dev server is pinned to that exact port. If you change it, update
// CORS_ORIGINS in the backend's .env as well.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 5173,
  },
});