import { useEffect, useRef, useState } from "react";
import { clientMessageSchema, serverMessageSchema, type Settings } from "@vinny-editor/shared";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function useServerConnection() {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [settings, setSettings] = useState<Settings | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${protocol}://${window.location.host}/ws`);
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setStatus("connected");
      const hello = clientMessageSchema.parse({
        type: "client:hello",
        clientId: crypto.randomUUID(),
      });
      socket.send(JSON.stringify(hello));
    });

    socket.addEventListener("message", (event) => {
      const parsed = serverMessageSchema.safeParse(JSON.parse(event.data));
      if (!parsed.success) return;
      if (parsed.data.type === "state:snapshot") {
        setSettings(parsed.data.settings);
      }
    });

    socket.addEventListener("close", () => setStatus("disconnected"));
    socket.addEventListener("error", () => setStatus("disconnected"));

    return () => socket.close();
  }, []);

  return { status, settings };
}
