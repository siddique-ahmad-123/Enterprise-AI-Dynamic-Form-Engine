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
    allowedHosts: true,
    // BACKEND_PROXY & COPILOT_RUNTIME_PROXY allow Docker Compose / server config override
    proxy: {
      "^(/enterprise-ai)?/auth": {
        target: process.env.BACKEND_PROXY || "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/enterprise-ai/, ""),
      },
      "^(/enterprise-ai)?/chat": {
        target: process.env.BACKEND_PROXY || "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/enterprise-ai/, ""),
      },
      "^(/enterprise-ai)?/applications": {
        target: process.env.BACKEND_PROXY || "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/enterprise-ai/, ""),
      },
      "^(/enterprise-ai)?/health": {
        target: process.env.BACKEND_PROXY || "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/enterprise-ai/, ""),
      },
      "^(/enterprise-ai)?/copilotkit": {
        target: process.env.COPILOT_RUNTIME_PROXY || "http://localhost:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/enterprise-ai/, ""),
      },
    },
  },
  base: process.env.VITE_BASE_PATH || "/",
});