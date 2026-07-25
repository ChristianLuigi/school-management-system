import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { validateWebEnvironment } from "./validate-environment.mjs";

validateWebEnvironment();
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const containerServer = path.resolve(scriptDirectory, "../server.js");
const localBuildServer = path.resolve(
  scriptDirectory,
  "../.next/standalone/apps/web/server.js",
);
const serverPath = existsSync(containerServer) ? containerServer : localBuildServer;
if (!existsSync(serverPath)) {
  throw new Error("Next.js standalone server artifact was not found. Run the production build first.");
}
await import(pathToFileURL(serverPath).href);