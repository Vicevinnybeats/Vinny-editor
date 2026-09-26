import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { AuthGate } from "./AuthGate";
import { ConnectionProvider } from "./connection";
import "./index.css";

if ("serviceWorker" in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateSW(true);
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Mobile browsers can leave a tab suspended for days without ever
      // re-checking for a new service worker, so poke it whenever the app
      // is actually brought back to the foreground.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void registration.update();
      });
    },
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthGate>
      <ConnectionProvider>
        <App />
      </ConnectionProvider>
    </AuthGate>
  </StrictMode>,
);
