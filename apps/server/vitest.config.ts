import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      WORKSPACE_ROOT: "./.test-workspace",
      DATABASE_PATH: "./.test-workspace/test.sqlite",
      AUTH_PASSPHRASE: "test-passphrase",
      SESSION_SECRET: "test-session-secret",
    },
  },
});
