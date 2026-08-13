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
  },
  base:"/copilotkit_frontend/",
});
