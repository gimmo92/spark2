import type { Metadata } from "next";
import { Forecast } from "@spark/mbo";

export const metadata: Metadata = { title: "Forecast MBO · Spark" };

export default function ForecastPage() {
  return <Forecast />;
}
