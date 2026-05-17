import { pathToFileURL } from "url";
import { logger } from "./logger";
import { run } from "./program";
import { checkFiles, codependence, script } from "./scripts";

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  run().catch((err) => {
    logger.error(err.message || err.toString());
    process.exit(1);
  });
}

export { checkFiles, codependence, script };
export default codependence;
