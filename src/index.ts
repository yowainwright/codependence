import configurationSchema from "./config/schema.json" with { type: "json" };
import { checkFiles, codependence, script } from "./manifest";

const schema = configurationSchema;

export { checkFiles, codependence, schema, script };
export default codependence;
