import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base ./ чтобы dist открывался с GH Pages / подпапки; для Telegram Mini App нужен https-туннель к dev-серверу
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    target: "es2020",
    minify: "esbuild",
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          markdown: ["react-markdown", "remark-breaks", "rehype-raw"],
        },
      },
    },
  },
  server: {
    port: 8081,
    strictPort: true,
    host: true,
  },
});