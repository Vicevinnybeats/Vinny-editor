import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AuthGate } from "./AuthGate";
import { ConnectionProvider } from "./connection";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthGate>
      <ConnectionProvider>
        <App />
      </ConnectionProvider>
    </AuthGate>
  </StrictMode>,
);
