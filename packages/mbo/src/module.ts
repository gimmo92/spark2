import type { SparkModule } from "@spark/core";

/** MBO module: schede obiettivo, catalogo obiettivi, preset, workflow (settings doc "mbo"). */
export const mboModule: SparkModule = {
  id: "mbo",
  collections: ["schede", "objectives", "presets", "workflows"],
};
