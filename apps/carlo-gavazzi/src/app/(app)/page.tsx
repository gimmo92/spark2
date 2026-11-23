import { redirect } from "next/navigation";
import config from "@/spark.config";

export default function Home() {
  redirect(config.home);
}
