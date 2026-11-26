import config from "@/spark.config";
import { createRoleWeightsRoute } from "@spark/transparency/routes/roles";

// the AI proposal of a large company's roles runs several model calls in parallel
export const maxDuration = 300;

export const { POST } = createRoleWeightsRoute(config);
