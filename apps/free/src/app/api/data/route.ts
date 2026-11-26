import config from "@/spark.config";
import { createDataRoute } from "@spark/core/routes/data";

export const { GET, POST } = createDataRoute(config);
