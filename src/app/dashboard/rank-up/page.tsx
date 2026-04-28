import { redirect } from "next/navigation";

export default function RankUpRedirect() {
  redirect("/dashboard/progress");
}
