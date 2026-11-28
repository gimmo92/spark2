import config from "@/spark.config";
import { createCcnlExtractRoute } from "@spark/transparency/routes/ccnlExtract";

// reading the table pages of an agreement can take a while
export const maxDuration = 300;

export const { POST } = createCcnlExtractRoute(config);
