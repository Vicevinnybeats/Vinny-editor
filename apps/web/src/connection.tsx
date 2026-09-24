import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import {
  clientMessageSchema,
  serverMessageSchema,
  type ChatMessage,
  type Settings,
  type Tab,
} from "@vinny-editor/shared";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface ConnectionState {
  status: ConnectionStatus;
  settings: Settings | null;
  tabs: Tab[];
  chatMessages: ChatMessage[];
}

type Action =
  | { kind: "status"; status: ConnectionStatus }
  | {
      kind: "snapshot";
      settings: Settings;
      tabs: Tab[];
      chatHistory: ChatMessage[];
    }
  | { kind: "settings"; settings: Settings }
  | { kind: "tabs"; tabs: Tab[] }
  | { kind: "chatMessage"; message: ChatMessage }
  | { kind: "chatDelta"; id: string; delta: string }
  | { kind: "chatDone"; id: string }
  | { kind: "chatError"; id: string; message: string };

function reducer(state: ConnectionState, action: Action): ConnectionState {
  switch (action.kind) {
    case "status":
      return { ...state, status: action.status };
    case "snapshot":
      return {
        ...state,
        settings: action.settings,
        tabs: action.tabs,
        chatMessages: action.chatHistory,
      };
    case "settings":
      return { ...state, settings: action.settings };
    case "tabs":
      return { ...state, tabs: action.tabs };
    case "chatMessage": {
      if (state.chatMessages.some((m) => m.id === action.message.id)) return state;
      return { ...state, chatMessages: [...state.chatMessages, action.message] };
    }
    case "chatDelta": {
      const existing = state.chatMessages.find((m) => m.id === action.id);
      if (!existing) {
        const created: ChatMessage = {
          id: action.id,
          role: "assistant",
          content: action.delta,
          createdAt: new Date().toISOString(),
          pending: true,
        };
        return { ...state, chatMessages: [...state.chatMessages, created] };
      }
      return {
        ...state,
        chatMessages: state.chatMessages.map((m) =>
          m.id === action.id ? { ...m, content: m.content + action.delta } : m,
        ),
      };
    }
    case "chatDone":
      return {
        ...state,
        chatMessages: state.chatMessages.map((m) =>
          m.id === action.id ? { ...m, pending: false } : m,
        ),
      };
    case "chatError":
      return {
        ...state,
        chatMessages: state.chatMessages.map((m) =>
          m.id === action.id ? { ...m, content: `Error: ${action.message}`, pending: false } : m,
        ),
      };
    default:
      return state;
  }
}

interface ConnectionApi extends ConnectionState {
  terminalInitialBuffer: string;
  sendTerminalInput: (data: string) => void;
  sendTerminalResize: (cols: number, rows: number) => void;
  subscribeTerminalOutput: (cb: (data: string) => void) => () => void;
  subscribeFsChange: (cb: (path: string) => void) => () => void;
}

const ConnectionContext = createContext<ConnectionApi | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    status: "connecting",
    settings: null,
    tabs: [],
    chatMessages: [],
  });

  const socketRef = useRef<WebSocket | null>(null);
  const terminalListeners = useRef(new Set<(data: string) => void>());
  const fsListeners = useRef(new Set<(path: string) => void>());
  const terminalInitialBuffer = useRef("");

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${protocol}://${window.location.host}/ws`);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        dispatch({ kind: "status", status: "connected" });
        const hello = clientMessageSchema.parse({
          type: "client:hello",
          clientId: crypto.randomUUID(),
        });
        socket.send(JSON.stringify(hello));
      });

      socket.addEventListener("message", (event: MessageEvent<string>) => {
        const parsed = serverMessageSchema.safeParse(JSON.parse(event.data));
        if (!parsed.success) return;
        const msg = parsed.data;
        switch (msg.type) {
          case "state:snapshot":
            terminalInitialBuffer.current = msg.terminalBuffer;
            dispatch({
              kind: "snapshot",
              settings: msg.settings,
              tabs: msg.tabs,
              chatHistory: msg.chatHistory,
            });
            break;
          case "settings:changed":
            dispatch({ kind: "settings", settings: msg.settings });
            break;
          case "tabs:changed":
            dispatch({ kind: "tabs", tabs: msg.tabs });
            break;
          case "chat:message":
            dispatch({ kind: "chatMessage", message: msg.message });
            break;
          case "chat:delta":
            dispatch({ kind: "chatDelta", id: msg.id, delta: msg.delta });
            break;
          case "chat:done":
            dispatch({ kind: "chatDone", id: msg.id });
            break;
          case "chat:error":
            dispatch({ kind: "chatError", id: msg.id, message: msg.message });
            break;
          case "fs:changed":
            for (const cb of fsListeners.current) cb(msg.path);
            break;
          case "terminal:output":
            for (const cb of terminalListeners.current) cb(msg.data);
            break;
          case "pong":
            break;
        }
      });

      socket.addEventListener("close", () => {
        dispatch({ kind: "status", status: "disconnected" });
        if (!cancelled) setTimeout(connect, 2000);
      });
      socket.addEventListener("error", () => socket.close());
    }

    connect();
    return () => {
      cancelled = true;
      socketRef.current?.close();
    };
  }, []);

  const sendTerminalInput = useCallback((data: string) => {
    socketRef.current?.send(JSON.stringify({ type: "terminal:input", data }));
  }, []);

  const sendTerminalResize = useCallback((cols: number, rows: number) => {
    socketRef.current?.send(JSON.stringify({ type: "terminal:resize", cols, rows }));
  }, []);

  const subscribeTerminalOutput = useCallback((cb: (data: string) => void) => {
    terminalListeners.current.add(cb);
    return () => terminalListeners.current.delete(cb);
  }, []);

  const subscribeFsChange = useCallback((cb: (path: string) => void) => {
    fsListeners.current.add(cb);
    return () => fsListeners.current.delete(cb);
  }, []);

  const value = useMemo<ConnectionApi>(
    () => ({
      ...state,
      terminalInitialBuffer: terminalInitialBuffer.current,
      sendTerminalInput,
      sendTerminalResize,
      subscribeTerminalOutput,
      subscribeFsChange,
    }),
    [state, sendTerminalInput, sendTerminalResize, subscribeTerminalOutput, subscribeFsChange],
  );

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnection(): ConnectionApi {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error("useConnection must be used within ConnectionProvider");
  return ctx;
}
