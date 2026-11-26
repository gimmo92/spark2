import config from "@/spark.config";
import { createSparkRoute } from "@spark/core/routes/spark";

export const { GET, PUT } = createSparkRoute(config);
