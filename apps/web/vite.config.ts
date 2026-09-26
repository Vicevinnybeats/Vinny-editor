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
          display: "standalone",
          start_url: "/",
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
