import config from "@/spark.config";
import { createRoleProfilesRoute } from "@spark/transparency/routes/profiles";

// profiles of a large company's roles run several model calls in parallel
export const maxDuration = 300;

export const { POST } = createRoleProfilesRoute(config);
