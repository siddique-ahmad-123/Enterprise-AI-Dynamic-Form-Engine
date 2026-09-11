import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      jsxRuntime: "automatic",
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "lucide": "lucide-react",
    },
  },
  server: {
    port: 5173,
    host: true,
    // BACKEND_PROXY env var allows Docker Compose to override (e.g. http://backend:8000)
    proxy: {
      "/auth": { target: process.env.BACKEND_PROXY || "http://localhost:8000", changeOrigin: true },
      "/chat": { target: process.env.BACKEND_PROXY || "http://localhost:8000", changeOrigin: true },
      "/health": { target: process.env.BACKEND_PROXY || "http://localhost:8000", changeOrigin: true },
    },
  },
  base:"/copilotkit_frontend/",
});
