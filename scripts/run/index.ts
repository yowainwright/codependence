import { fileURLToPath } from "node:url";
import { registerTypeScriptResolver, runTests } from "./utils.ts";

registerTypeScriptResolver();

const scriptPath = fileURLToPath(import.meta.url);
const isDirectExecution = process.argv[1] === scriptPath;

if (isDirectExecution) runTests(process.argv.slice(2), import.meta.url);
