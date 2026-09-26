import type {
  ChatMessage,
  FileEntry,
  GitStatus,
  SearchMatch,
  Settings,
  Tab,
} from "@vinny-editor/shared";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, (body as { error?: string }).error ?? response.statusText);
  }
  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const authApi = {
  login: (passphrase: string) =>
    request<{ ok: true }>("/auth/login", { method: "POST", body: JSON.stringify({ passphrase }) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  status: () => request<{ authenticated: boolean }>("/auth/status"),
};

export const fsApi = {
  tree: (path = "") =>
    request<{ entries: FileEntry[] }>(`/fs/tree?path=${encodeURIComponent(path)}`),
  file: (path: string) =>
    request<{ path: string; content: string }>(`/fs/file?path=${encodeURIComponent(path)}`),
  write: (path: string, content: string) =>
    request<{ ok: true }>("/fs/file", { method: "PUT", body: JSON.stringify({ path, content }) }),
};

export const tabsApi = {
  list: () => request<{ tabs: Tab[] }>("/tabs"),
  open: (path: string) =>
    request<{ tabs: Tab[] }>("/tabs/open", { method: "POST", body: JSON.stringify({ path }) }),
  close: (path: string) =>
    request<{ tabs: Tab[] }>("/tabs/close", { method: "POST", body: JSON.stringify({ path }) }),
  buffer: (path: string, buffer: string, dirty: boolean) =>
    request<{ tabs: Tab[] }>("/tabs/buffer", {
      method: "PUT",
      body: JSON.stringify({ path, buffer, dirty }),
    }),
};

export const gitApi = {
  status: () => request<GitStatus>("/git/status"),
  diff: (path: string | undefined, staged: boolean) =>
    request<{ diff: string }>(
      `/git/diff?${path ? `path=${encodeURIComponent(path)}&` : ""}staged=${staged}`,
    ),
  stage: (path: string) =>
    request<{ status: GitStatus }>("/git/stage", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  unstage: (path: string) =>
    request<{ status: GitStatus }>("/git/unstage", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  commit: (message: string) =>
    request<{ status: GitStatus }>("/git/commit", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};

export const searchApi = {
  query: (q: string) => request<{ matches: SearchMatch[] }>(`/search?q=${encodeURIComponent(q)}`),
};

export const settingsApi = {
  get: () => request<Settings>("/settings"),
  update: (settings: Settings) =>
    request<Settings>("/settings", { method: "PUT", body: JSON.stringify(settings) }),
};

export const chatApi = {
  history: () => request<{ messages: ChatMessage[] }>("/chat/history"),
  send: (content: string) =>
    request<{ userMessage: ChatMessage; assistantId: string }>("/chat/message", {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
};

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

export const execApi = {
  run: (command: string) =>
    request<CommandResult>("/exec/run", { method: "POST", body: JSON.stringify({ command }) }),
};
