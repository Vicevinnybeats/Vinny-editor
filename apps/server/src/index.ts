import { buildServer } from "./server.js";
import { env } from "./env.js";

// TEMPORARY debug line - remove after diagnosing the login issue.
console.log("DEBUG AUTH_PASSPHRASE as loaded:", JSON.stringify(env.AUTH_PASSPHRASE));

const server = buildServer();

server.listen({ port: env.SERVER_PORT, host: "0.0.0.0" }).catch((err) => {
  server.log.error(err);
  process.exit(1);
});
