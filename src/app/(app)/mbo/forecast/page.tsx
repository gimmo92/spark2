import type { Metadata } from "next";
import { Forecast } from "@/components/Forecast";

export const metadata: Metadata = { title: "Forecast MBO · Spark" };

export default function ForecastPage() {
  return <Forecast />;
}
