import type {
  ChatMessage,
  CustomConnector,
  FileEntry,
  GitStatus,
  Project,
  SearchMatch,
  Settings,
  Skill,
  Tab,
} from "@vinny-editor/shared";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
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
  upload: (path: string, file: File | Blob) =>
    request<{ ok: true }>(`/fs/upload?path=${encodeURIComponent(path)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: file,
    }),
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
  push: () => request<{ status: GitStatus }>("/git/push", { method: "POST" }),
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

export const projectsApi = {
  list: () => request<{ projects: Project[]; activeProjectId: string | null }>("/projects"),
  add: (name: string, path: string) =>
    request<{ project: Project }>("/projects", {
      method: "POST",
      body: JSON.stringify({ name, path }),
    }),
  clone: (url: string, token: string | undefined, name: string | undefined) =>
    request<{ project: Project }>("/projects/clone", {
      method: "POST",
      body: JSON.stringify({ url, token, name }),
    }),
  switchTo: (id: string) =>
    request<{ projects: Project[]; activeProjectId: string | null }>("/projects/switch", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),
  remove: (id: string) =>
    request<{ projects: Project[]; activeProjectId: string | null }>(`/projects/${id}`, {
      method: "DELETE",
    }),
  setPreviewPort: (id: string, port: number | null) =>
    request<{ projects: Project[] }>(`/projects/${id}/preview-port`, {
      method: "PUT",
      body: JSON.stringify({ port }),
    }),
};

export interface GithubRepo {
  fullName: string;
  htmlUrl: string;
  private: boolean;
  updatedAt: string;
}

export const githubApi = {
  listRepos: () => request<{ repos: GithubRepo[] }>("/github/repos"),
};

export interface ConnectorsStatus {
  ollama: { connected: boolean; model: string; baseUrl: string };
  github: { connected: boolean; hasToken: boolean };
}

export type CustomConnectorWithStatus = CustomConnector & { connected: boolean };

export const connectorsApi = {
  status: () => request<ConnectorsStatus>("/connectors/status"),
  listCustom: () => request<{ connectors: CustomConnectorWithStatus[] }>("/connectors/custom"),
  addCustom: (name: string, url: string, token: string | undefined) =>
    request<{ connector: CustomConnector }>("/connectors/custom", {
      method: "POST",
      body: JSON.stringify({ name, url, token }),
    }),
  removeCustom: (id: string) =>
    request<{ ok: true }>(`/connectors/custom/${id}`, { method: "DELETE" }),
};

export const skillsApi = {
  list: () => request<{ skills: Skill[] }>("/skills"),
  add: (name: string, content: string) =>
    request<{ skill: Skill }>("/skills", {
      method: "POST",
      body: JSON.stringify({ name, content }),
    }),
  fetchFromUrl: (url: string, path: string | undefined, name: string | undefined) =>
    request<{ skill: Skill }>("/skills/fetch", {
      method: "POST",
      body: JSON.stringify({ url, path, name }),
    }),
  setEnabled: (id: string, enabled: boolean) =>
    request<{ skills: Skill[] }>(`/skills/${id}`, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    }),
  remove: (id: string) => request<{ skills: Skill[] }>(`/skills/${id}`, { method: "DELETE" }),
};
