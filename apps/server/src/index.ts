import { buildServer } from "./server.js";
import { env } from "./env.js";

const server = buildServer();

server.listen({ port: env.SERVER_PORT, host: "0.0.0.0" }).catch((err) => {
  server.log.error(err);
  process.exit(1);
});
