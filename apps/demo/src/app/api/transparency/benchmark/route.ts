import config from "@/spark.config";
import { createBenchmarkRoute } from "@spark/transparency/routes/benchmark";

// the estimate of a large company's roles runs several model calls in parallel
export const maxDuration = 300;

export const { POST } = createBenchmarkRoute(config);
