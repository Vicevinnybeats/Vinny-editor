import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const serverPort = env.SERVER_PORT ?? "4310";

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: false,
        manifest: {
          name: "Vinny Editor",
          short_name: "Vinny",
          description: "Personal AI code editor, powered by Qwen 3.",
          theme_color: "#0f1115",
          background_color: "#0f1115",
          // "fullscreen" hides everything, including the OS status bar -
          // Android/Chrome honors it. "standalone" (still no browser
          // address bar, just the status bar) is the fallback for browsers
          // that don't support fullscreen. iOS ignores this whole field and
          // goes by the apple-mobile-web-app-* meta tags in index.html
          // instead.
          display: "standalone",
          display_override: ["fullscreen", "standalone"],
          start_url: "/",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
      }),
    ],
    server: {
      port: Number(env.WEB_PORT ?? 4173),
      proxy: {
        "/ws": {
          target: `ws://127.0.0.1:${serverPort}`,
          ws: true,
        },
        "/api": {
          target: `http://127.0.0.1:${serverPort}`,
        },
      },
    },
  };
});
