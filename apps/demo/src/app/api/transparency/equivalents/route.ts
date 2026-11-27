import config from "@/spark.config";
import { createEquivalentsRoute } from "@spark/transparency/routes/equivalents";

export const { POST } = createEquivalentsRoute(config);
