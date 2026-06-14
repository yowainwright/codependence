import { resolve } from "node:path";
import { pathToFileURL } from "url";
import { logger } from "./logger";
import { run } from "./program";
import { checkFiles, codependence, script } from "./scripts";

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

/* c8 ignore next 5 */
if (isDirectExecution) {
  run().catch((err) => {
    logger.error(err.message || err.toString());
    process.exit(2);
  });
}

export { checkFiles, codependence, script };
export default codependence;
