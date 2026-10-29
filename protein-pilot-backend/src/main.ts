import { buildApp } from "./app.js";
process.umask(0o077);
const { app, config } = await buildApp();
await app.listen({ host: config.host, port: config.port });
console.log(`Protein Pilot API listening on ${config.host}:${config.port}`);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
