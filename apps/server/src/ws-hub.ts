import type { WebSocket } from "ws";
import type { ServerMessage } from "@vinny-editor/shared";

const sockets = new Set<WebSocket>();

export function registerSocket(socket: WebSocket) {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
}

export function broadcast(message: ServerMessage, exclude?: WebSocket) {
  const payload = JSON.stringify(message);
  for (const socket of sockets) {
    if (socket === exclude || socket.readyState !== socket.OPEN) continue;
    socket.send(payload);
  }
}
