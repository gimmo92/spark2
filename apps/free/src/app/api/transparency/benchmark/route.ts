import config from "@/spark.config";
import { createBenchmarkRoute } from "@spark/transparency/routes/benchmark";

export const maxDuration = 120;

export const { POST } = createBenchmarkRoute(config);
